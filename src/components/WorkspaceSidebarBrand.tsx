import { HPCE_LOGO_NO_TAGLINE_SRC, HPCE_LOGO_WHITE_HD_SRC } from '../lib/brandAssets';
import { HoverTooltip } from './HoverTooltip';

interface WorkspaceSidebarBrandProps {
  collapsed: boolean;
  displayName?: string;
}

/**
 * HPCE lockup — black ground, white uppercase type, large wordmark.
 */
export function WorkspaceSidebarBrand({ collapsed, displayName }: WorkspaceSidebarBrandProps) {
  if (collapsed) {
    return (
      <HoverTooltip content="HPCE · ELEMENT IQ" placement="right">
        <div className="w-full py-3">
          <img
            src={HPCE_LOGO_NO_TAGLINE_SRC}
            alt="HPCE"
            className="block w-full h-auto min-h-[52px] object-contain brightness-[1.06] contrast-[1.08]"
            draggable={false}
            decoding="async"
          />
        </div>
      </HoverTooltip>
    );
  }

  return (
    <figure className="m-0 bg-black px-2 py-7">
      <div className="w-full overflow-hidden">
        <img
          src={HPCE_LOGO_WHITE_HD_SRC}
          alt="Hoang Pham Consulting Engineers"
          width={750}
          height={434}
          className="block w-full h-auto min-h-[120px] object-contain object-left brightness-[1.06] contrast-[1.08]"
          draggable={false}
          decoding="async"
        />
      </div>
      <figcaption className="mt-5 pt-4">
        <p className="text-[15px] font-bold uppercase tracking-[0.12em] text-white leading-snug">
          Element IQ
        </p>
        {displayName && (
          <p className="mt-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-white/80 truncate leading-snug">
            {displayName}
          </p>
        )}
      </figcaption>
    </figure>
  );
}
