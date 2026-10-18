import { useRef, type ComponentProps } from 'react';
import { Button } from './Button';

export const HOLD_MS = 500;

type Props = Omit<ComponentProps<typeof Button>, 'onClick'> & {
  onTap: () => void;
  /** 長押しで呼ぶ（量の入力など） */
  onHold?: () => void;
};

/** タップと長押しを分けるボタン */
export function HoldButton({ onTap, onHold, ...rest }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <Button
      {...rest}
      onPointerDown={() => {
        held.current = false;
        if (!onHold) return;
        clear();
        timer.current = setTimeout(() => {
          held.current = true;
          onHold();
        }, HOLD_MS);
      }}
      onPointerUp={clear}
      onPointerLeave={clear}
      onContextMenu={(e) => {
        if (onHold) e.preventDefault();
      }}
      onClick={() => {
        clear();
        if (held.current) {
          held.current = false;
          return;
        }
        onTap();
      }}
    />
  );
}
