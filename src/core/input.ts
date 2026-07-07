export type Button =
  | 'up' | 'down' | 'left' | 'right'
  | 'shoot' | 'bomb' | 'focus' | 'pause' | 'confirm' | 'back' | 'skip';

const KEY_MAP = new Map<string, Button[]>([
  ['ArrowUp', ['up']],
  ['ArrowDown', ['down']],
  ['ArrowLeft', ['left']],
  ['ArrowRight', ['right']],
  ['KeyZ', ['shoot', 'confirm']],
  ['Enter', ['shoot', 'confirm']],
  ['KeyX', ['bomb', 'back']],
  ['ShiftLeft', ['focus']],
  ['ShiftRight', ['focus']],
  ['ControlLeft', ['skip']],
  ['ControlRight', ['skip']],
  ['Escape', ['pause', 'back']]
]);

export interface InputFrame {
  held: Set<Button>;
  pressed: Set<Button>;
}

export class Input {
  private held = new Set<Button>();
  private codes = new Set<string>();
  private downEdges = new Set<Button>();

  constructor() {
    addEventListener('keydown', (e) => this.down(e), { passive: false });
    addEventListener('keyup', (e) => this.up(e), { passive: false });
    addEventListener('blur', () => {
      this.held.clear();
      this.codes.clear();
      this.downEdges.clear();
    });
  }

  private down(event: KeyboardEvent): void {
    const buttons = KEY_MAP.get(event.code);
    if (!buttons) return;
    event.preventDefault();
    this.codes.add(event.code);
    for (const button of buttons) {
      if (!event.repeat && !this.held.has(button)) this.downEdges.add(button);
      this.held.add(button);
    }
  }

  private up(event: KeyboardEvent): void {
    const buttons = KEY_MAP.get(event.code);
    if (!buttons) return;
    event.preventDefault();
    this.codes.delete(event.code);
    // Rebuild held from the remaining codes so overlapping bindings survive.
    this.held.clear();
    for (const code of this.codes) {
      for (const button of KEY_MAP.get(code) ?? []) this.held.add(button);
    }
  }

  // Test hook: injects synthetic state for one frame.
  inject(held: Iterable<Button>, pressed: Iterable<Button>): void {
    for (const b of pressed) this.downEdges.add(b);
    for (const b of held) this.held.add(b);
  }

  clearInjected(): void {
    this.held.clear();
    this.codes.clear();
  }

  frame(): InputFrame {
    const pressed = new Set(this.downEdges);
    this.downEdges.clear();
    return { held: new Set(this.held), pressed };
  }
}
