"""
Housing.com AI Content Agent — CLI entry point.

Usage:
  python main.py run                         # single run (uses .env settings)
  python main.py run --dry-run               # force dry-run (no live posting)
  python main.py run --topic "Mumbai metro"  # focus the research on a topic
  python main.py run --platforms twitter,instagram
  python main.py serve                       # start FastAPI server + scheduler
  python main.py slack-bot                   # start Slack bot (Socket Mode)
  python main.py history                     # show recent run stats from DB
  python main.py ui                          # start UI dev server (http://localhost:8000)
"""
from __future__ import annotations

# Load .env before any SDK imports so env vars are available to all clients
from dotenv import load_dotenv
load_dotenv()

import asyncio
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import click
from rich.console import Console
from rich.live import Live
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn, TimeElapsedColumn
from rich.table import Table
from rich.text import Text

console = Console()


# ─── CLI ─────────────────────────────────────────────────────────────────────

@click.group()
def cli():
    pass


@cli.command()
@click.option("--dry-run/--live", default=None, help="Override DRY_RUN from .env")
@click.option("--topic", default=None, help="Focus hint for the researcher agent")
@click.option("--platforms", default=None, help="Comma-separated platforms e.g. twitter,instagram")
def run(dry_run, topic, platforms):
    """Run a full end-to-end content generation pipeline."""
    _setup_logging()

    from config import get_settings
    settings = get_settings()

    effective_dry_run = dry_run if dry_run is not None else settings.dry_run
    platform_list = [p.strip() for p in platforms.split(",")] if platforms else settings.platform_list
    run_id = str(uuid.uuid4())[:8]

    # Set up per-run file logger BEFORE the graph starts
    from tools.run_logger import setup_run_logging
    from tools.run_context import set_run_id as _set_run_id
    import logging as _logging
    log_path = setup_run_logging(run_id)
    _set_run_id(run_id)   # propagate run_id to all tools via ContextVar
    _logging.getLogger(__name__).info(
        "Run %s started | dry_run=%s | platforms=%s | topic=%s | log=%s",
        run_id, effective_dry_run, platform_list, topic, log_path,
    )

    _print_banner(run_id, effective_dry_run, platform_list, topic)

    initial_state = {
        "run_id": run_id,
        "triggered_at": datetime.now(timezone.utc).isoformat(),
        "dry_run": effective_dry_run,
        "topic_hint": topic,
        "slack_topic": None,
        "target_platforms": platform_list,
        "research": [],
        "trends": [],
        "content_briefs": [],
        "creative_drafts": [],
        "platform_posts": [],
        "qa_results": [],
        "approved_posts": [],
        "published": [],
        "retry_count": 0,
        "qa_post_attempts": {},
        "error": None,
    }

    final_state = asyncio.run(_run_with_progress(initial_state))

    import logging as _logging
    _logging.getLogger(__name__).info(
        "Run %s complete | stories=%d | trends=%d | drafts=%d | posts_attempted=%d "
        "| approved=%d | published=%d",
        run_id,
        len(final_state.get("research", [])),
        len(final_state.get("trends", [])),
        len(final_state.get("creative_drafts", [])),
        len(final_state.get("platform_posts", [])),
        len(final_state.get("approved_posts", [])),
        len(final_state.get("published", [])),
    )
    _print_results(final_state, run_id)


@cli.command()
def serve():
    """Start the FastAPI server with scheduled runs (9 AM + 6 PM IST)."""
    import uvicorn
    from scheduler.jobs import register_jobs, scheduler

    _setup_logging()
    register_jobs()
    scheduler.start()

    console.print(Panel(
        "[bold green]Housing.com Content Agent[/bold green]\n"
        "API: http://localhost:8000\n"
        "Docs: http://localhost:8000/docs\n"
        "Trigger a run: POST http://localhost:8000/run",
        title="Server Starting",
    ))
    uvicorn.run("api.server:app", host="0.0.0.0", port=8000, reload=False)


@cli.command()
def ui():
    """Start the UI + API server at http://localhost:8000 (build UI first: cd ui && npm run build)."""
    import uvicorn
    _setup_logging()
    console.print(Panel(
        "[bold green]Housing.com Marketeer UI[/bold green]\n"
        "UI + API: [cyan]http://localhost:8000[/cyan]\n"
        "API Docs: [cyan]http://localhost:8000/docs[/cyan]\n\n"
        "[dim]To build the UI first:[/dim]\n"
        "  cd ui && npm install && npm run build\n\n"
        "[dim]For hot-reload UI dev:[/dim]\n"
        "  Terminal 1: python main.py ui\n"
        "  Terminal 2: cd ui && npm run dev",
        title="UI Server",
        border_style="blue",
    ))
    uvicorn.run("api.server:app", host="0.0.0.0", port=8000, reload=True)


@cli.command("slack-bot")
def slack_bot_cmd():
    """Start the Slack bot (Socket Mode). Requires SLACK_BOT_TOKEN + SLACK_APP_TOKEN."""
    _setup_logging()
    console.print(Panel(
        "[bold]Housing.com Slack Bot[/bold]\n"
        "Listening for DMs and @mentions.\n"
        "DM the bot with a topic/URL/trend to generate posts.\n"
        "Press Ctrl+C to stop.",
        title="Slack Bot",
        border_style="green",
    ))
    from tools.slack_bot import run_socket_mode_bot
    run_socket_mode_bot()


@cli.command()
def history():
    """Show stats from the engagement database."""
    _setup_logging()
    try:
        from db.connection import get_db_session
        from db.models import PublishedPostRecord
        from sqlalchemy import desc

        with get_db_session() as session:
            records = (
                session.query(PublishedPostRecord)
                .order_by(desc(PublishedPostRecord.published_at))
                .limit(20)
                .all()
            )

        if not records:
            console.print("[yellow]No published posts in database yet.[/yellow]")
            return

        table = Table(title="Recent Published Posts", show_lines=True)
        table.add_column("Run ID", style="dim")
        table.add_column("Platform", style="cyan")
        table.add_column("Content (preview)", style="white", max_width=50)
        table.add_column("QA Score", justify="right")
        table.add_column("Pred ER", justify="right")
        table.add_column("Actual ER 7d", justify="right")
        table.add_column("Published", style="dim")

        for r in records:
            actual = f"[green]{r.actual_engagement_7d:.1%}[/green]" if r.actual_engagement_7d else "[dim]pending[/dim]"
            table.add_row(
                r.run_id[:8],
                r.platform,
                r.content[:60] + "...",
                f"{r.qa_overall:.1f}/10" if r.qa_overall else "—",
                f"{r.pred_engagement_rate:.1%}" if r.pred_engagement_rate else "—",
                actual,
                r.published_at.strftime("%d %b %H:%M") if r.published_at else "—",
            )

        console.print(table)
    except Exception as exc:
        console.print(f"[red]DB error: {exc}[/red]")


# ─── Progress wrapper ─────────────────────────────────────────────────────────

async def _run_with_progress(initial_state: dict) -> dict:
    from workflow.graph import get_graph

    steps = [
        ("researcher",          "Researching real estate news..."),
        ("trend_researcher",    "Scanning trending topics..."),
        ("planner",             "Planning content angles..."),
        ("social_creative",     "Generating social content ideas..."),
        ("news_creative",       "Generating news content briefs..."),
        ("internal_retriever",  "Finding housing.com internal links..."),
        ("platform_agents",     "Creating platform-specific posts..."),
        ("qa_agent",            "Running QA checks..."),
        ("publisher",           "Publishing / saving output..."),
        ("notifier",            "Sending Slack notification..."),
    ]

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        TimeElapsedColumn(),
        console=console,
        transient=False,
    ) as progress:
        task = progress.add_task("[cyan]Initialising...[/cyan]", total=None)

        # Stream graph execution step by step
        final_state = initial_state
        step_idx = 0
        run_id = initial_state["run_id"]
        g = await get_graph()
        async for event in g.astream(
            initial_state,
            stream_mode="updates",
            config={"configurable": {"thread_id": run_id}},
        ):
            node_name = list(event.keys())[0] if event else ""
            label = next((lbl for nm, lbl in steps if nm == node_name), node_name)
            if label:
                progress.update(task, description=f"[cyan]{label}[/cyan]")
                step_idx += 1

            # Merge updates into final_state
            for updates in event.values():
                if isinstance(updates, dict):
                    for k, v in updates.items():
                        if isinstance(v, list) and isinstance(final_state.get(k), list):
                            # For Annotated list fields (platform_posts), extend
                            final_state[k] = final_state.get(k, []) + v
                        else:
                            final_state[k] = v

        progress.update(task, description="[green]Done![/green]")

    return final_state


# ─── Rich output helpers ──────────────────────────────────────────────────────

def _print_banner(run_id: str, dry_run: bool, platforms: list[str], topic: str | None):
    mode = "[yellow]DRY RUN[/yellow]" if dry_run else "[bold red]LIVE[/bold red]"
    console.print(Panel(
        f"[bold]Housing.com AI Content Agent[/bold]\n"
        f"Run ID: [cyan]{run_id}[/cyan] · Mode: {mode}\n"
        f"Platforms: [green]{', '.join(platforms)}[/green]\n"
        + (f"Topic hint: [yellow]{topic}[/yellow]" if topic else ""),
        title="Starting Run",
        border_style="blue",
    ))


def _print_results(state: dict, run_id: str):
    console.print()

    # Research summary
    research = state.get("research", [])
    if research:
        t = Table(title=f"Research: {len(research)} Stories Found", show_lines=False)
        t.add_column("Headline", style="white", max_width=60)
        t.add_column("Source", style="dim", max_width=20)
        for item in research[:5]:
            t.add_row(item.get("headline", "")[:60], item.get("source", ""))
        console.print(t)

    # Trends
    trends = state.get("trends", [])
    if trends:
        t = Table(title=f"Trends: Top {min(5, len(trends))} Topics")
        t.add_column("Hashtag", style="cyan")
        t.add_column("Platform", style="dim")
        t.add_column("Creative Hook", style="white", max_width=50)
        for item in trends[:5]:
            t.add_row(item.get("hashtag", ""), item.get("platform", ""), item.get("creative_hook", "")[:50])
        console.print(t)

    # QA results
    qa_results = state.get("qa_results", [])
    if qa_results:
        t = Table(title="QA Results")
        t.add_column("Platform", style="cyan")
        t.add_column("Decision", justify="center")
        t.add_column("Quality", justify="right")
        t.add_column("Pred ER", justify="right")
        t.add_column("Issues")
        for r in qa_results:
            decision_style = {"publish": "green", "revise": "yellow", "reject": "red"}.get(r["decision"], "white")
            t.add_row(
                r["platform"],
                f"[{decision_style}]{r['decision'].upper()}[/{decision_style}]",
                f"{r.get('overall_quality_score', 0):.1f}/10",
                f"{r.get('pred_engagement_rate', 0):.1%}",
                (r.get("revision_notes") or ", ".join(r.get("quality_issues", [])))[:50],
            )
        console.print(t)

    # Published output
    published = state.get("published", [])
    if published:
        t = Table(title="Output")
        t.add_column("Platform", style="cyan")
        t.add_column("Location", style="green")
        for p in published:
            loc = p.get("url", "") if p.get("url") != "dry_run" else p.get("output_path", "")
            t.add_row(p.get("platform", ""), loc)
        console.print(t)

    run_dir = Path("output") / run_id
    console.print(Panel(
        f"[bold green]Run complete![/bold green]\n"
        f"Output directory: [cyan]{run_dir}[/cyan]\n"
        f"Posts approved:   [cyan]{len(state.get('approved_posts', []))}[/cyan]\n"
        f"Posts published:  [cyan]{len(published)}[/cyan]",
        border_style="green",
    ))


# ─── Logging ─────────────────────────────────────────────────────────────────

def _setup_logging():
    import logging
    from config import get_settings
    console_level = getattr(logging, get_settings().log_level.upper(), logging.INFO)

    # Console handler at INFO (or configured level) — stays clean
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(console_level)
    console_handler.setFormatter(logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    ))

    # Root logger at DEBUG so the per-run file handler (added later) gets everything;
    # the console handler's own level acts as its gate.
    root = logging.getLogger()
    root.setLevel(logging.DEBUG)
    root.addHandler(console_handler)

    # Quiet noisy libraries
    for noisy in ("httpx", "httpcore", "urllib3", "tweepy", "apify_client", "apify_shared", "asyncio"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    # Suppress LangChain deprecation warnings
    import warnings
    warnings.filterwarnings("ignore", category=DeprecationWarning, module="langgraph")


if __name__ == "__main__":
    cli()
