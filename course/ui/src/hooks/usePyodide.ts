import { useState, useEffect, useRef, useCallback } from 'react'

export type PyodideStatus = 'idle' | 'loading' | 'ready' | 'running' | 'error'

export interface RunResult {
  stdout: string
  stderr: string
  elapsedMs: number
  success: boolean
}

const MOCK_INJECTIONS = `
import json, time, sys
from io import StringIO

# Mock Anthropic client for in-browser demos
class _MockMessage:
    def __init__(self, text, stop_reason="end_turn", input_tokens=150, output_tokens=80):
        self.content = [type('Block', (), {'text': text, 'type': 'text'})()]
        self.stop_reason = stop_reason
        self.usage = type('Usage', (), {'input_tokens': input_tokens, 'output_tokens': output_tokens})()

class _MockMessages:
    _call_count = 0
    @staticmethod
    def create(**kwargs):
        _MockMessages._call_count += 1
        msgs = kwargs.get('messages', [])
        last = msgs[-1]['content'] if msgs else ''
        # Return tool_use on first call if tools present, end_turn on subsequent
        if kwargs.get('tools') and _MockMessages._call_count % 2 == 1:
            tool_name = kwargs['tools'][0]['name']
            import json as _json
            block = type('Block', (), {
                'type': 'tool_use',
                'id': f'tool_{_MockMessages._call_count}',
                'name': tool_name,
                'input': {'query': str(last)[:50]}
            })()
            msg = _MockMessage('', stop_reason='tool_use')
            msg.content = [block]
            return msg
        result = _json.dumps([{"title": "Mumbai prices rise 8%", "content": "Stamp duty cut expected", "url": "https://housing.com/news"}])
        return _MockMessage(result)

class MockAnthropicClient:
    class messages:
        create = _MockMessages.create

def web_search(query, max_results=5):
    return [{"title": f"RE result: {query}", "content": "Mumbai property prices up 8% YoY. Bengaluru IT corridor sees demand.", "url": "https://housing.com/news"}]

# Patch asyncio for simple demos
import asyncio as _asyncio
try:
    _loop = _asyncio.get_event_loop()
except:
    _loop = _asyncio.new_event_loop()
    _asyncio.set_event_loop(_loop)
`

export function usePyodide() {
  const [status, setStatus] = useState<PyodideStatus>('idle')
  const workerRef = useRef<Worker | null>(null)
  const pendingRef = useRef<((r: RunResult) => void) | null>(null)

  useEffect(() => {
    setStatus('loading')
    // Use inline worker approach for Vite compatibility
    const workerCode = `
importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js');

let pyodide = null;

async function loadPyodide_() {
  pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/' });
  self.postMessage({ type: 'ready' });
}

loadPyodide_();

self.onmessage = async (e) => {
  if (e.data.type !== 'run') return;
  const start = Date.now();
  try {
    pyodide.runPython('import sys; from io import StringIO; _stdout = StringIO(); _stderr = StringIO(); sys.stdout = _stdout; sys.stderr = _stderr');
    await pyodide.runPythonAsync(e.data.code);
    const stdout = pyodide.runPython('_stdout.getvalue()');
    const stderr = pyodide.runPython('_stderr.getvalue()');
    pyodide.runPython('sys.stdout = sys.__stdout__; sys.stderr = sys.__stderr__');
    self.postMessage({ type: 'result', stdout, stderr, elapsedMs: Date.now() - start, success: true });
  } catch (err) {
    self.postMessage({ type: 'result', stdout: '', stderr: String(err), elapsedMs: Date.now() - start, success: false });
  }
};
`
    const blob = new Blob([workerCode], { type: 'application/javascript' })
    const url = URL.createObjectURL(blob)
    const worker = new Worker(url)
    workerRef.current = worker

    worker.onmessage = (e) => {
      if (e.data.type === 'ready') {
        setStatus('ready')
        URL.revokeObjectURL(url)
      } else if (e.data.type === 'result') {
        setStatus('ready')
        pendingRef.current?.(e.data as RunResult)
        pendingRef.current = null
      }
    }

    worker.onerror = () => setStatus('error')

    return () => {
      worker.terminate()
      URL.revokeObjectURL(url)
    }
  }, [])

  const runCode = useCallback(
    (code: string): Promise<RunResult> => {
      return new Promise((resolve) => {
        if (!workerRef.current || status !== 'ready') {
          resolve({ stdout: '', stderr: 'Pyodide not ready yet', elapsedMs: 0, success: false })
          return
        }
        setStatus('running')
        pendingRef.current = resolve
        workerRef.current.postMessage({ type: 'run', code: MOCK_INJECTIONS + '\n' + code })
      })
    },
    [status],
  )

  return { status, runCode }
}
