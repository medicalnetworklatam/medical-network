import { useEffect } from 'react'

/** Sets the browser tab's title */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = title
  }, [title])
}
