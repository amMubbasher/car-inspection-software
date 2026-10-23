'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';
import { Car, UserCog, Users, ShieldCheck, Menu, X, LogOut, Percent } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { usePermissions } from '@/components/rbac/PermissionsProvider';
import type { Permission } from '@/lib/rbac/permissions';
import { LanguageModal } from '@/components/modals/LanguageModal';
import { getSelectedCountryFlag, useGoogleTranslate } from '@/components/i18n/GoogleTranslateProvider';
import { countryCodeToLocale } from '@/lib/countryToLocale';
import { DEFAULT_COUNTRY_CODE } from '@/lib/popularLanguages';
import logo from "../../logo.png"
import Image from 'next/image';

function isNavActive(pathname: string, href: string, hrefs: string[]) {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  return !hrefs.some(
    (other) =>
      other !== href &&
      (pathname === other || pathname.startsWith(`${other}/`))
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(DEFAULT_COUNTRY_CODE);
  const [languageOpen, setLanguageOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const mobileLanguageMenuRef = useRef<HTMLDivElement>(null);

  const { data: session } = useSession();
  const { can, me } = usePermissions();
  const googleTranslate = useGoogleTranslate();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const savedLanguage = localStorage.getItem('selectedLanguage');
    if (savedLanguage) {
      setSelectedLanguage(savedLanguage);
      document.documentElement.lang = countryCodeToLocale(savedLanguage);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        languageMenuRef.current?.contains(target) ||
        mobileLanguageMenuRef.current?.contains(target)
      ) {
        return;
      }
      setLanguageOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectLanguage = (countryCode: string) => {
    setSelectedLanguage(countryCode);
    localStorage.setItem('selectedLanguage', countryCode);
    document.documentElement.lang = countryCodeToLocale(countryCode);
    googleTranslate.setLanguageByCountryCode(countryCode);
  };

  if (pathname === '/login') return null;

  const signedInName = session?.user?.name?.trim() || session?.user?.email || "";
  const signedInEmail = session?.user?.email || "";
  const showEmail = Boolean(signedInEmail && signedInEmail !== signedInName);

  const roleName = me?.role?.name ?? '';

  const navLinks: { href: string; label: string; icon: typeof Car; permission?: Permission }[] = [
    { href: '/dashboard', label: 'Dashboard', icon: UserCog },
    { href: '/dashboard/post-job', label: 'Post Job', icon: Car, permission: 'jobs.create' },
    { href: '/dashboard/users', label: 'Users', icon: Users, permission: 'users.view' },
    { href: '/dashboard/roles', label: 'Roles', icon: ShieldCheck, permission: 'roles.view' },
    { href: '/dashboard/vat', label: 'VAT', icon: Percent, permission: 'vat.view' },
  ];
  const visibleLinks = navLinks.filter((link) => !link.permission || can(link.permission));

  return (
    <header
      className={cn(
        "fixed top-0 z-50 w-full border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950",
        scrolled && "shadow-sm"
      )}
    >
      <div className="mx-auto flex h-16 items-center justify-between gap-4 px-4 lg:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold">
            <Image
              src={logo}
              alt="Motor Expert"
              width={36}
              height={36}
              className="rounded-md"
            />
            <span className="text-gray-900 dark:text-white">Motor Expert</span>
          </Link>


          <nav className="hidden items-center gap-1 rounded-full border border-gray-200 bg-gray-100 p-1 lg:flex dark:border-gray-800 dark:bg-gray-900">
            {visibleLinks
              .map((link) => {
                const Icon = link.icon;
                const hrefs = navLinks.map((item) => item.href);
                const isActive = isNavActive(pathname, link.href, hrefs);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
          </nav>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {signedInName && (
            <div className={cn("notranslate min-w-0 max-w-[140px] text-right leading-tight sm:max-w-[220px] lg:hidden", mobileOpen && "max-lg:hidden")} translate="no">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                {signedInName}
              </p>
              {showEmail && (
                <p className="hidden truncate text-xs text-gray-500 sm:block">
                  {signedInEmail}
                </p>
              )}
            </div>
          )}

          <div className="hidden items-center gap-2 lg:flex">
            <div className="relative notranslate" ref={languageMenuRef} translate="no">
              <button
                type="button"
                onClick={() => setLanguageOpen((open) => !open)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-xl transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
                aria-label="Select language"
              >
                {getSelectedCountryFlag(selectedLanguage)}
              </button>
              <LanguageModal
                isOpen={languageOpen}
                selectedCountryCode={selectedLanguage}
                onSelect={handleSelectLanguage}
                onClose={() => setLanguageOpen(false)}
              />
            </div>
            <ThemeToggle />
            <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-gray-800" />
            {signedInName && (
              <div className="notranslate flex min-w-0 max-w-[160px] items-center gap-2.5 rounded-full border border-gray-200 bg-gray-50 py-1 pl-1 pr-3 xl:max-w-[240px] dark:border-gray-800 dark:bg-gray-900" translate="no">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                  {signedInName.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">
                    {signedInName}
                  </span>
                  {roleName ? (
                    <span className="block truncate text-xs text-gray-500">{roleName}</span>
                  ) : showEmail && (
                    <span className="hidden truncate text-xs text-gray-500 xl:block">{signedInEmail}</span>
                  )}
                </span>
              </div>
            )}
            {session && (
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex h-9 items-center gap-2 rounded-xl bg-red-500 px-3 text-sm font-medium text-white hover:bg-red-400"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            )}
          </div>

          <div className="hidden md:block lg:hidden">
            <ThemeToggle />
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 rounded-md hover:bg-accent"
            onClick={() => {
              setMobileOpen((open) => !open);
              setLanguageOpen(false);
            }}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <nav className="border-t border-gray-200 bg-gray-50 px-3 py-3 lg:hidden dark:border-gray-800 dark:bg-gray-950">
          <div className="rounded-2xl border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            {signedInName && (
              <div className="notranslate flex items-center gap-3 px-2 py-2" translate="no">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
                  {signedInName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                    {signedInName}
                  </p>
                  {showEmail && (
                    <p className="truncate text-xs text-gray-500">{signedInEmail}</p>
                  )}
                  {roleName && (
                    <p className="truncate text-xs text-indigo-600 dark:text-indigo-400">{roleName}</p>
                  )}
                </div>
              </div>
            )}

            <div className="mx-2 my-1 h-px bg-gray-100 dark:bg-gray-800" />

            <div className="space-y-1">
              {visibleLinks
                .map((link) => {
                  const Icon = link.icon;
                  const hrefs = navLinks.map((item) => item.href);
                  const isActive = isNavActive(pathname, link.href, hrefs);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-2 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-indigo-600 text-white"
                          : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg",
                          isActive
                            ? "bg-white/15 text-white"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      {link.label}
                    </Link>
                  );
                })}
            </div>

            <div className="mx-2 my-2 h-px bg-gray-100 dark:bg-gray-800" />

            <div className="flex items-center gap-2 px-1">
              <div className="relative min-w-0 flex-1 notranslate" ref={mobileLanguageMenuRef} translate="no">
                <button
                  type="button"
                  onClick={() => setLanguageOpen((open) => !open)}
                  className="flex h-9 w-full items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
                >
                  <span className="text-lg leading-none">{getSelectedCountryFlag(selectedLanguage)}</span>
                  Language
                </button>
                <LanguageModal
                  isOpen={languageOpen}
                  selectedCountryCode={selectedLanguage}
                  onSelect={(code) => {
                    handleSelectLanguage(code);
                    setMobileOpen(false);
                  }}
                  onClose={() => setLanguageOpen(false)}
                />
              </div>
              <ThemeToggle />
            </div>

            {session && (
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-red-500 text-sm font-medium text-white hover:bg-red-400"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
