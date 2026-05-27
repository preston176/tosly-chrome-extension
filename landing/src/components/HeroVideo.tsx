import { AnimatePresence, motion, useSpring } from "framer-motion";
import { Play, Plus } from "lucide-react";
import { useCallback, useEffect, useState, type MouseEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";

const VIDEO_ID = "ivAgRwcxAH4";
const THUMBNAIL = `https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`;

const SPRING = { mass: 0.1 };

export default function HeroVideo() {
  const [open, setOpen] = useState(false);

  const x = useSpring(0, SPRING);
  const y = useSpring(0, SPRING);
  const opacity = useSpring(0, SPRING);

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    opacity.set(1);
    const bounds = e.currentTarget.getBoundingClientRect();
    x.set(e.clientX - bounds.left);
    y.set(e.clientY - bounds.top);
  };

  const close = useCallback(() => setOpen(false), []);

  const handleTriggerClick = (e: MouseEvent) => {
    e.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && <VideoPopOver close={close} />}
          </AnimatePresence>,
          document.body,
        )}

      <div
        onMouseMove={handlePointerMove}
        onMouseLeave={() => opacity.set(0)}
        onClick={handleTriggerClick}
        role="button"
        tabIndex={0}
        aria-label="Play Tosly demo video"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="relative w-full overflow-hidden rounded-2xl cursor-pointer group"
        style={{
          aspectRatio: "16/9",
          boxShadow:
            "0 32px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)",
        }}
      >
        <img
          src={THUMBNAIL}
          alt="Watch Tosly in action"
          className="absolute inset-0 h-full w-full object-cover"
        />

        <div className="absolute inset-0 bg-black/40 transition-colors duration-300 group-hover:bg-black/25" />

        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 60% at 50% 100%, rgba(239,68,68,0.18) 0%, transparent 70%)",
          }}
        />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative flex items-center justify-center">
            <span
              className="absolute h-24 w-24 rounded-full bg-white/10 animate-ping"
              style={{ animationDuration: "2s" }}
            />
            <span
              className="absolute h-20 w-20 rounded-full bg-white/10 animate-ping"
              style={{ animationDuration: "2s", animationDelay: "0.4s" }}
            />
            <div
              className="relative flex h-16 w-16 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110"
              style={{
                background: "rgba(255,255,255,0.95)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
              }}
            >
              <Play className="size-5 fill-ink text-ink" style={{ marginLeft: 2 }} />
            </div>
          </div>
        </div>

        <motion.div
          style={{ x, y, opacity }}
          className="pointer-events-none absolute left-0 top-0 z-20 flex w-fit select-none items-center gap-2 p-2 text-sm font-medium text-white mix-blend-exclusion"
        >
          <Play className="size-4 fill-white" /> Play
        </motion.div>
      </div>
    </>
  );
}

function VideoPopOver({ close }: { close: () => void }) {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [close]);

  const handleBackdropClick = (e: MouseEvent) => {
    e.stopPropagation();
    close();
  };

  const handleCloseButton = (e: MouseEvent) => {
    e.stopPropagation();
    close();
  };

  return (
    <div className="fixed left-0 top-0 z-[101] flex h-screen w-screen items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute left-0 top-0 h-full w-full backdrop-blur-lg"
        style={{ background: "rgba(0,0,0,0.85)" }}
        onClick={handleBackdropClick}
      />

      <motion.div
        initial={{ clipPath: "inset(43.5% 43.5% 33.5% 43.5%)", opacity: 0 }}
        animate={{ clipPath: "inset(0 0 0 0)", opacity: 1 }}
        exit={{
          clipPath: "inset(43.5% 43.5% 33.5% 43.5%)",
          opacity: 0,
          transition: {
            duration: 1,
            type: "spring",
            stiffness: 100,
            damping: 20,
            opacity: { duration: 0.2, delay: 0.8 },
          },
        }}
        transition={{
          duration: 1,
          type: "spring",
          stiffness: 100,
          damping: 20,
        }}
        className="relative mx-4 aspect-video w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleCloseButton}
          aria-label="Close video"
          className="absolute -top-10 right-0 z-10 flex cursor-pointer items-center gap-1.5 rounded-full p-1 text-sm font-medium text-white/70 transition-colors hover:text-white"
        >
          <Plus className="size-5 rotate-45" />
        </button>

        <iframe
          src={`https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1&rel=0&modestbranding=1`}
          title="Tosly demo"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full rounded-2xl border-0"
          style={{ boxShadow: "0 40px 100px rgba(0,0,0,0.5)" }}
        />
      </motion.div>
    </div>
  );
}
