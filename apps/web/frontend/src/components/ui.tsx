import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LinkProps } from "react-router-dom";
import type { VaultState } from "../lib/vault";

type Variant = "lime" | "ghost" | "white";

const variants: Record<Variant, string> = {
  lime: "bg-lime text-ink hover:brightness-95",
  ghost: "border border-lime/60 text-white hover:bg-lime/10",
  white: "bg-white text-ink hover:bg-white/90",
};
export const btn = (v: Variant = "lime") =>
  `inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${variants[v]}`;

export function Button({
  variant = "lime",
  className = "",
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${btn(variant)} ${className}`} {...p} />;
}

export function LinkButton({
  variant = "lime",
  className = "",
  ...p
}: LinkProps & { variant?: Variant }) {
  return <Link className={`${btn(variant)} ${className}`} {...p} />;
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`glass rounded-2xl p-5 ${className}`}>{children}</div>;
}

export function Page({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
        {title}
      </h1>
      {intro && <p className="mt-3 max-w-2xl text-white/65">{intro}</p>}
      <div className="mt-8 space-y-6">{children}</div>
    </main>
  );
}

export const stateColor: Record<VaultState, string> = {
  Active: "#7CFF3F",
  Watch: "#F5B83D",
  TriggerPending: "#FF8A5B",
  VetoWindow: "#FF6B4A",
  StagedRelease: "#8FD3FF",
  Executed: "#B8B8B8",
};

export function StateChip({ state }: { state: VaultState }) {
  return (
    <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold">
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: stateColor[state] }}
        aria-hidden
      />
      {state}
    </span>
  );
}

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-extrabold md:text-3xl">{value}</div>
      <div className="mt-1 text-xs text-white/60">{label}</div>
    </div>
  );
}

export const field =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-white/40 focus:border-lime";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-white/65">{label}</span>
      {children}
    </label>
  );
}

export function Locked({ title, text }: { title: string; text: string }) {
  return (
    <Card className="text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/70">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="4" y="11" width="16" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 018 0v3" />
        </svg>
        <span className="sr-only">Locked</span>
      </div>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-white/60">{text}</p>
    </Card>
  );
}
