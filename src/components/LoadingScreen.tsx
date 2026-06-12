import React from 'react';
import { HPCE_LOGO_BLACK_SRC, HPCE_LOGO_NO_TAGLINE_SRC, HPCE_LOGO_WHITE_HD_SRC } from '../lib/brandAssets';
import { cn } from '../lib/utils';

export type LoadingTextVariant = 'page' | 'panel' | 'embed';

export interface LoadingContentProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  showBrand?: boolean;
  showProgress?: boolean;
  /** 0–1 determinate bar; omit for indeterminate animation */
  progress?: number;
  spinnerSize?: 'sm' | 'md' | 'lg';
  compact?: boolean;
  brandSize?: 'md' | 'lg';
  textVariant?: LoadingTextVariant;
}

const LOADING_TEXT: Record<
  LoadingTextVariant,
  { block: string; eyebrow: string; title: string; subtitle: string }
> = {
  page: {
    block: 'mt-8',
    eyebrow: 'text-[11px] font-medium uppercase tracking-[0.22em] text-[#484848]',
    title: 'text-[15px] font-normal text-[#c9c9c9] tracking-[0.02em] leading-relaxed',
    subtitle: 'text-[12px] font-normal text-[#5a5a5a] leading-relaxed',
  },
  panel: {
    block: 'mt-5',
    eyebrow: 'text-[10px] font-medium uppercase tracking-[0.2em] text-[#404040]',
    title: 'text-[13px] font-normal text-[#8a8a8a] tracking-[0.015em] leading-relaxed',
    subtitle: 'text-[11px] font-normal text-[#505050] leading-relaxed',
  },
  embed: {
    block: 'mt-4',
    eyebrow: 'text-[9px] font-medium uppercase tracking-[0.18em] text-[#454545]',
    title: 'text-[12px] font-normal text-[#707070] tracking-[0.01em] leading-snug',
    subtitle: 'text-[11px] font-normal text-[#505050] leading-relaxed',
  },
};

export function BrandHeader({
  tagline,
  size = 'lg',
  variant = 'dark',
  className,
}: {
  tagline?: string;
  size?: 'md' | 'lg';
  /** dark = white logo on transparent (login); light = black logo on transparent */
  variant?: 'light' | 'dark';
  className?: string;
}) {
  const logoClass =
    size === 'lg' ? 'h-28 w-full max-w-[360px]' : 'h-20 w-full max-w-[280px]';

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <img
        src={variant === 'light' ? HPCE_LOGO_BLACK_SRC : HPCE_LOGO_WHITE_HD_SRC}
        alt="HPCE"
        className={cn(logoClass, 'object-contain')}
        draggable={false}
        decoding="async"
      />
      {tagline && (
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#858585] max-w-[280px] text-center leading-relaxed">
          {tagline}
        </p>
      )}
    </div>
  );
}

export function Spinner({
  size = 'md',
  withLogo = false,
}: {
  size?: 'sm' | 'md' | 'lg';
  withLogo?: boolean;
}) {
  const box =
    size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-32 h-32' : 'w-20 h-20';
  const border = size === 'sm' ? 'border-[1.5px]' : 'border-2';
  const logoInset = size === 'lg' ? 'inset-[8%]' : 'inset-[10%]';

  return (
    <div className={`relative ${box}`} role="status" aria-label="Loading">
      <div className={`absolute inset-0 ${border} border-[#10b981]/15 rounded-full`} />
      <div
        className={`absolute inset-0 ${border} border-[#10b981] border-t-transparent rounded-full animate-spin`}
      />
      {withLogo ? (
        <div
          className={`absolute ${logoInset} flex items-center justify-center pointer-events-none`}
        >
          <img
            src={HPCE_LOGO_NO_TAGLINE_SRC}
            alt=""
            aria-hidden
            className="max-h-full max-w-full object-contain"
            draggable={false}
            decoding="async"
          />
        </div>
      ) : (
        <div className="absolute inset-[35%] rounded-full bg-[#10b981]/20 animate-pulse" />
      )}
    </div>
  );
}

function ProgressBar({
  compact = false,
  progress,
}: {
  compact?: boolean;
  progress?: number;
}) {
  const width = progress != null ? `${Math.min(1, Math.max(0, progress)) * 100}%` : undefined;

  return (
    <div className={`${compact ? 'w-28' : 'w-52'} h-1 bg-[#2a2a2a] rounded-full overflow-hidden`}>
      <div
        className={`h-full rounded-full bg-[#10b981]/70 ${
          progress == null ? 'w-1/3 project-loading-bar' : 'transition-[width] duration-700 ease-out'
        }`}
        style={width != null ? { width } : undefined}
      />
    </div>
  );
}

export function LoadingContent({
  eyebrow,
  title,
  subtitle,
  showBrand = false,
  showProgress = true,
  progress,
  spinnerSize = 'md',
  compact = false,
  brandSize = 'lg',
  textVariant = 'page',
}: LoadingContentProps) {
  const text = LOADING_TEXT[textVariant];
  const logoInSpinner = spinnerSize !== 'sm';

  return (
    <div className="flex flex-col items-center text-center select-none">
      {showBrand && !logoInSpinner && (
        <div className="mb-10">
          <BrandHeader size={brandSize} />
        </div>
      )}

      <Spinner size={spinnerSize} withLogo={logoInSpinner} />

      <div className={text.block}>
        {eyebrow && <p className={text.eyebrow}>{eyebrow}</p>}
        <p className={cn(text.title, eyebrow && 'mt-2.5')}>{title}</p>
        {subtitle && (
          <p className={cn(text.subtitle, 'mt-2 max-w-[260px]')}>{subtitle}</p>
        )}
      </div>

      {showProgress && (
        <div className="mt-6">
          <ProgressBar compact={compact} progress={progress} />
        </div>
      )}
    </div>
  );
}

export function DotGridOverlay() {
  return (
    <div
      className="absolute inset-0 opacity-[0.025] pointer-events-none"
      style={{
        backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
        backgroundSize: '24px 24px',
      }}
    />
  );
}

export interface LoadingScreenProps extends LoadingContentProps {
  variant?: 'full' | 'inline';
  background?: 'app' | 'admin' | 'editor';
}

const BACKGROUNDS: Record<NonNullable<LoadingScreenProps['background']>, string> = {
  app: 'bg-[#0f1117]',
  admin: 'bg-[#0a0a0a]',
  editor: 'bg-editor-bg',
};

export function LoadingScreen({
  variant = 'full',
  background = 'app',
  showBrand = false,
  showProgress = true,
  spinnerSize = 'md',
  compact = false,
  ...contentProps
}: LoadingScreenProps) {
  if (variant === 'inline') {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <LoadingContent
          {...contentProps}
          showBrand={false}
          showProgress={showProgress}
          spinnerSize={spinnerSize}
          compact={compact}
        />
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${BACKGROUNDS[background]} flex items-center justify-center p-6 relative overflow-hidden`}
    >
      <DotGridOverlay />
      <div className="relative z-10">
        <LoadingContent
          {...contentProps}
          showBrand={showBrand}
          showProgress={showProgress}
          spinnerSize={spinnerSize}
          compact={compact}
        />
      </div>
    </div>
  );
}

/** Compact loader for admin tabs and embedded panels */
export function PanelLoading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center justify-center py-16 px-4">
      <LoadingContent
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        showProgress={false}
        spinnerSize="md"
        compact
        textVariant="panel"
      />
    </div>
  );
}
