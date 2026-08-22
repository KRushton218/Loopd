import { useEffect, useState } from 'react'

// Layout-driven behaviour (portals, which columns exist) can't be done in CSS
// alone, so the breakpoint has to be readable from JS too. Kept in one place
// so it can only ever disagree with the stylesheet in one spot.
export const DESKTOP = '(min-width: 1024px)'

export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )

  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return matches
}
