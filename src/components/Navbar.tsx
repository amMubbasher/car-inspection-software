'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Car, UserCog, Home, Menu, X, LogOut } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { containerVariants, itemVariants } from "@/lib/animations";
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
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(DEFAULT_COUNTRY_CODE);
  const [languageOpen, setLanguageOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement>(null);

  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const googleTranslate = useGoogleTranslate();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
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
      if (languageMenuRef.current && !languageMenuRef.current.contains(e.target as Node)) {
        setLanguageOpen(false);
      }
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

  if (status === 'loading' || pathname === '/login') return null;

  const dashboardHref = role === 'team' ? '/team/dashboard' : '/admin/dashboard';
  const dashboardLabel = role === 'team' ? 'Dashboard' : 'Admin Dashboard';

  const navLinks = [
    { href: dashboardHref, label: dashboardLabel, icon: UserCog, roles: ['admin', 'team'] },
    // { href: '/team/dashboard', label: 'Team Dashboard', icon: Wrench, roles: ['admin', 'team'] },
    { href: '/admin/dashboard/post-job', label: 'Post Job', icon: Car, roles: ['admin', 'team'] },
    { href: '/admin/dashboard/users', label: 'Users', icon: Home, roles: ['admin'] },
  ];

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100 }}
      className={cn(
        "w-full fixed top-0 z-50 border-b bg-background/80 backdrop-blur-md transition-all duration-300",
        scrolled ? "py-2 shadow-lg" : "py-4"
      )}
    >
      <div className="mx-auto px-4 flex items-center justify-between">
        {/* Left Section */}
        <motion.div
          className="flex items-center space-x-8"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {/* <motion.div variants={itemVariants}>
            <Link
              href="/"
              className="flex items-center gap-2 text-xl font-bold relative"
              onMouseEnter={() => setHoveredLink('home')}
              onMouseLeave={() => setHoveredLink(null)}
            >
              <motion.div
                animate={{
                  rotate: hoveredLink === 'home' ? 10 : 0,
                  scale: hoveredLink === 'home' ? 1.1 : 1
                }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <Car className="w-6 h-6 text-primary" />
              </motion.div>
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Motor Expert
              </span>
              {hoveredLink === 'home' && (
                <motion.span
                  className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500"
                  initial="hidden"
                  animate="show"
                  variants={underlineVariants}
                  transition={{ duration: 0.3 }}
                />
              )}
            </Link>
          </motion.div> */}

        <motion.div variants={itemVariants}>
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-bold relative"
            onMouseEnter={() => setHoveredLink('home')}
            onMouseLeave={() => setHoveredLink(null)}
          >
            <motion.div
              animate={{
                scale: hoveredLink === 'home' ? 1.05 : 1
              }}
              transition={{ type: "spring", stiffness: 400 }}
              className="flex items-center gap-2"
            >
              <Image
                src={logo}
                alt="AutoSure Logo"
                width={36}
                height={36}
                className="rounded-md"
              />
              <span className="text-gray-900 dark:text-white">
                Motor Expert
              </span>
            </motion.div>
          </Link>
        </motion.div>


          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks
              .filter((link) => link.roles.includes(role))
              .map((link) => {
                const Icon = link.icon;
                const hrefs = navLinks.map((item) => item.href);
                const isActive = isNavActive(pathname, link.href, hrefs);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-indigo-600 text-white"
                        : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
          </nav>
        </motion.div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          <div className="relative notranslate" ref={languageMenuRef} translate="no">
            <motion.button
              variants={itemVariants}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => setLanguageOpen((open) => !open)}
              className="flex items-center justify-center w-9 h-9 rounded-lg border bg-background hover:bg-accent transition-colors text-xl"
              aria-label="Select language"
            >
              {getSelectedCountryFlag(selectedLanguage)}
            </motion.button>
            <LanguageModal
              isOpen={languageOpen}
              selectedCountryCode={selectedLanguage}
              onSelect={handleSelectLanguage}
              onClose={() => setLanguageOpen(false)}
            />
          </div>

          <motion.div
            variants={itemVariants}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="hidden md:block"
          >
            <ThemeToggle />
          </motion.div>

          {/* Logout Button - Desktop */}
          {session && (
            <motion.button
              variants={itemVariants}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="hidden lg:flex items-center gap-2 rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-400"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </motion.button>
          )}

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 rounded-md hover:bg-accent"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <motion.nav
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="lg:hidden bg-background border-t px-4 pb-4"
        >
          {navLinks
            .filter((link) => link.roles.includes(role))
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
                    "mt-1 flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-indigo-600 text-white"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {link.label}
                </Link>
              );
            })}
          <div className="mt-4 flex items-center gap-4">
            <div className="relative notranslate" translate="no">
              <button
                type="button"
                onClick={() => setLanguageOpen((open) => !open)}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border hover:bg-accent"
              >
                <span className="text-lg">{getSelectedCountryFlag(selectedLanguage)}</span>
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
            {session && (
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex items-center gap-2 rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-400"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            )}
          </div>
        </motion.nav>
      )}
    </motion.header>
  );
}
