export function shouldEmitReadComplete(input: { alreadySent: boolean; visible: boolean; dwellMs: number }): boolean {
  return !input.alreadySent && input.visible && input.dwellMs >= 15000;
}
