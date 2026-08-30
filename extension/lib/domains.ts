// Tosly's own web properties. Scanning our own Terms and Privacy pages is
// self-referential noise, so the extension stays quiet on these hosts.
const OWN_HOSTS = ["tosly.online"]

export function isOwnHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "")
  return OWN_HOSTS.some((own) => host === own || host.endsWith(`.${own}`))
}

export function isOwnUrl(url: string): boolean {
  try {
    return isOwnHostname(new URL(url).hostname)
  } catch {
    return false
  }
}
