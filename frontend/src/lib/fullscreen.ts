export async function enterFullscreen(element: HTMLElement = document.documentElement): Promise<boolean> {
  try {
    if (document.fullscreenElement) return true
    await element.requestFullscreen()
    return true
  } catch {
    return false
  }
}

export async function exitFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    }
  } catch {
    /* ignore */
  }
}
