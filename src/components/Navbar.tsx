'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Car, Wrench, UserCog, Home, Menu, X, LogOut } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { containerVariants, itemVariants, underlineVariants } from "@/lib/animations";
import { LanguageModal } from '@/components/modals/LanguageModal';
import { getSelectedCountryFlag, useGoogleTranslate } from '@/components/i18n/GoogleTranslateProvider';
import { countryCodeToLocale } from '@/lib/countryToLocale';
import { DEFAULT_COUNTRY_CODE } from '@/lib/popularLanguages';
import logo from "../../logo.png"
import Image from 'next/image';

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

  if (status === 'loading') return null;

  const dashboardHref = role === 'team' ? '/team/dashboard' : '/admin/dashboard';
  const dashboardLabel = role === 'team' ? 'Dashboard' : 'Admin Dashboard';

  const navLinks = [
    { href: dashboardHref, label: dashboardLabel, icon: UserCog, roles: ['admin', 'team'] },
    // { href: '/team/dashboard', label: 'Team Dashboard', icon: Wrench, roles: ['admin', 'team'] },
    { href: '/admin/dashboard/post-job', label: 'Post Job', icon: Car, roles: ['admin'] },
    { href: '/admin/dashboard/add-user', label: 'Add User', icon: Home, roles: ['admin'] },
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
                Car Inspection
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
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Car Inspection
              </span>
            </motion.div>

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
        </motion.div>


          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center space-x-6">
            {navLinks
              .filter((link) => link.roles.includes(role))
              .map((link) => {
                const Icon = link.icon;
                const isActive = pathname.startsWith(link.href);
                return (
                  <motion.div
                    key={link.href}
                    variants={itemVariants}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onMouseEnter={() => setHoveredLink(link.href)}
                    onMouseLeave={() => setHoveredLink(null)}
                  >
                    <Link
                      href={link.href}
                      className={cn(
                        "relative flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors",
                        isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <motion.div
                        animate={{
                          rotate: hoveredLink === link.href ? 10 : 0,
                          scale: hoveredLink === link.href ? 1.2 : 1
                        }}
                        transition={{ type: "spring", stiffness: 400 }}
                      >
                        <Icon className="w-5 h-5" />
                      </motion.div>
                      <span>{link.label}</span>

                      {(isActive || hoveredLink === link.href) && (
                        <motion.span
                          className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500"
                          initial="hidden"
                          animate="show"
                          variants={underlineVariants}
                          transition={{ duration: 0.3 }}
                        />
                      )}
                    </Link>
                  </motion.div>
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
              className="hidden lg:flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-lg shadow-md transition-all duration-200"
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
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2 py-2 text-sm font-medium transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
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
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-lg shadow-md transition-all duration-200"
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
