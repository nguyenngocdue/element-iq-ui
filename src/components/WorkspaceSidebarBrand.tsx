import { HPCE_LOGO_NO_TAGLINE_SRC, HPCE_LOGO_WHITE_HD_SRC } from '../lib/brandAssets';
import { useAuth } from '../lib/auth-context';
import { getUserDisplayFromAuth } from '../lib/userDisplay';
import { HoverTooltip } from './HoverTooltip';
import { UserTooltipContent } from './tooltipContent';

interface WorkspaceSidebarBrandProps {
  collapsed: boolean;
  displayName?: string;
  userEmail?: string | null;
}

/**
 * HPCE lockup — black ground, white uppercase type, large wordmark.
 */
export function WorkspaceSidebarBrand({ collapsed, displayName, userEmail }: WorkspaceSidebarBrandProps) {
  const { user } = useAuth();
  const self = getUserDisplayFromAuth(user);

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
      <figcaption className="mt-5 pt-4 border-t border-white/10">
        <p className="mt-4 text-center text-lg font-bold uppercase tracking-[0.28em] text-white leading-snug">
          Element IQ
        </p>
        {(displayName || userEmail) && (
          <div className="mt-4 rounded-md bg-[#141414] border border-[#262626] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            {displayName &&
              (self ? (
                <HoverTooltip
                  className="block min-w-0"
                  content={
                    <UserTooltipContent
                      userId={self.uid}
                      name={self.fullName}
                      username={self.username}
                      email={self.email}
                    />
                  }
                >
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/80 truncate leading-snug cursor-default">
                    {displayName}
                  </p>
                </HoverTooltip>
              ) : (
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/80 truncate leading-snug">
                  {displayName}
                </p>
              ))}
            {userEmail && (
              <p
                className={`text-[11px] font-normal normal-case tracking-normal text-[#a3a3a3] truncate leading-snug${displayName ? ' mt-2' : ''}`}
              >
                {userEmail}
              </p>
            )}
          </div>
        )}
      </figcaption>
    </figure>
  );
}
