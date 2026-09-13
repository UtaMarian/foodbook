import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

type ViewerImage = { id: string; url: string; width: number; height: number };

/** Vizualizare pe tot ecranul, cu paginare orizontala (scroll-snap) intre poze. */
export function ImageViewer({
  images,
  initialIndex,
  open,
  onClose,
}: {
  images: ViewerImage[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setIndex(initialIndex);
    requestAnimationFrame(() => {
      trackRef.current?.scrollTo({ left: initialIndex * trackRef.current.clientWidth });
    });
  }, [open, initialIndex]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || images.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div
        ref={trackRef}
        className="flex h-full snap-x snap-mandatory overflow-x-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {images.map((img) => (
          <div key={img.id} className="flex h-full w-full shrink-0 snap-start items-center justify-center" onClick={onClose}>
            <img
              src={img.url}
              alt=""
              className="max-h-full max-w-full object-contain"
              style={{ aspectRatio: img.height > 0 ? img.width / img.height : undefined }}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Închide"
        className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-black/50 text-white"
      >
        <X size={26} />
      </button>

      {images.length > 1 ? (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1">
          <span className="text-[13px] font-bold text-white">
            {index + 1} / {images.length}
          </span>
        </div>
      ) : null}
    </div>
  );
}
