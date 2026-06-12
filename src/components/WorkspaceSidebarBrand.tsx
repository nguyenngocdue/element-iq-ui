import { HPCE_LOGO_WHITE_HD_SRC } from '../lib/brandAssets';
import { cn } from '../lib/utils';
import { HoverTooltip } from './HoverTooltip';

interface WorkspaceSidebarBrandProps {
  collapsed: boolean;
}

/**
 * HPCE wordmark lockup — bars + company name, full width in expanded sidebar.
 */
export function WorkspaceSidebarBrand({ collapsed }: WorkspaceSidebarBrandProps) {
  if (collapsed) {
    return (
      <HoverTooltip content="HPCE · Element IQ" placement="right">
        <div
          className={cn(
            'mx-auto flex h-11 w-11 items-center justify-center rounded-lg',
            'bg-[#111111] ring-1 ring-inset ring-white/[0.08]',
          )}
        >
          <span className="text-[11px] font-semibold tracking-[0.14em] text-white leading-none">
            HPCE
          </span>
        </div>
      </HoverTooltip>
    );
  }

  return (
    <figure className="m-0 px-4 py-6">
      <img
        src={HPCE_LOGO_WHITE_HD_SRC}
        alt="Hoang Pham Consulting Engineers"
        width={750}
        height={434}
        className="block w-full h-auto object-contain object-left brightness-[1.03] contrast-[1.04]"
        draggable={false}
        decoding="async"
      />
      <figcaption className="sr-only">HPCE · Element IQ</figcaption>
    </figure>
  );
}
