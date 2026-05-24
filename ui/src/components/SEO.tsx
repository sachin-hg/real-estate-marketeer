import { Helmet } from 'react-helmet-async'

const BASE_URL = (import.meta.env.VITE_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''
const BRAND = (import.meta.env.VITE_APP_NAME as string | undefined) ?? 'NAVA'
const DEFAULT_OG_IMAGE = BASE_URL ? `${BASE_URL}/og.png` : '/og.png'

interface SEOProps {
  title: string
  description: string
  canonical?: string
  keywords?: string
  ogImage?: string
  ogType?: string
  noIndex?: boolean
  brandName?: string
  structuredData?: object | object[]
}

export function SEO({
  title,
  description,
  canonical,
  keywords,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = 'website',
  noIndex = false,
  brandName = BRAND,
  structuredData,
}: SEOProps) {
  const canonicalUrl = canonical && BASE_URL ? `${BASE_URL}${canonical}` : undefined
  const schemas = structuredData
    ? Array.isArray(structuredData) ? structuredData : [structuredData]
    : []

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      {noIndex
        ? <meta name="robots" content="noindex,nofollow" />
        : <meta name="robots" content="index,follow" />
      }
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content={brandName} />
      <meta property="og:locale" content="en_IN" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Structured Data */}
      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  )
}
