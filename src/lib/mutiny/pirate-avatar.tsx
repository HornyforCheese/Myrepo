import { useEffect, useRef, useState } from "react";
import "./pirate-avatar.css";

export function PirateAvatar({
  state,
  visible,
  enabled,
}: {
  state: "idle" | "thinking" | "talking";
  visible: boolean;
  enabled: boolean;
}) {
  const [blink, setBlink] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const [inViewport, setInViewport] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) =>
      setInViewport(entries.some((entry) => entry.isIntersecting)),
    );
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  const [foreground, setForeground] = useState(!document.hidden);
  useEffect(() => {
    const change = () => setForeground(!document.hidden);
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  const active = visible && foreground && inViewport && enabled;
  useEffect(() => {
    if (!active) {
      setBlink(false);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(
        () => {
          setBlink(true);
          timer = setTimeout(() => {
            setBlink(false);
            schedule();
          }, 110);
        },
        4500 + Math.random() * 3000,
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, [active]);
  return (
    <div
      ref={root}
      className="mutiny-pirate"
      data-state={active ? state : "idle"}
      role="img"
      aria-label={`Pirate assistant: ${state}`}
    >
      <img src="/ai-avatar/pixel_pirate_with_charcoal_glove.png" alt="" width={1280} height={960} />
      {active && blink && <span className="mutiny-pirate-blink" />}
      {active && state === "talking" && <span className="mutiny-pirate-mouth" />}
    </div>
  );
}
