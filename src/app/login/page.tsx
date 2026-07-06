"use client";

import { signIn, getSession } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Mail, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { containerVariants, itemVariants, cardVariants, hoverVariants} from "@/lib/animations";
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hoverStates, setHoverStates] = useState({
    email: false,
    password: false,
    submit: false
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email: email.trim().toLowerCase(),
        password,
      });

      if (res?.ok) {
        const session = await getSession();
        const destination =
          session?.user?.role === "admin"
            ? "/admin/dashboard"
            : "/team/dashboard";
        router.push(destination);
        return;
      }

      setError(
        res?.error === "CredentialsSignin"
          ? "Invalid email or password"
          : res?.error || "Login failed. Please try again."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Login failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 px-4">
      <motion.div
        initial="hidden"
        animate="show"
        variants={containerVariants}
        className="w-full max-w-md"
      >
        <motion.div variants={itemVariants}>
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl mt-2 font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Welcome Back
            </h1>
            <p className="text-muted-foreground mt-2">Sign in to your account</p>
          </motion.div>
        </motion.div>

        <motion.div variants={cardVariants}>
          <Card className="w-full backdrop-blur-sm bg-white/80 dark:bg-gray-900/80 border border-gray-200/50 dark:border-gray-700/50 shadow-xl overflow-hidden">
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.5 }}
              className="h-1 bg-gradient-to-r from-blue-500 to-purple-500"
            />

            <CardHeader>
              <motion.div
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400 }}
                className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center mb-4"
              >
                <Lock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </motion.div>
              <CardTitle className="text-2xl text-center">Login</CardTitle>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleLogin} className="space-y-6">
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-300">
                        <AlertTriangle className="w-5 h-5" />
                        <p className="text-sm">{error}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div 
                  variants={itemVariants}
                  className="space-y-2"
                >
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </Label>
                  <motion.div
                    whileHover="hover"
                    variants={hoverVariants}
                  >
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className={cn(
                        "bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm",
                        hoverStates.email && "border-blue-400 dark:border-blue-500"
                      )}
                      onFocus={() => setHoverStates(prev => ({ ...prev, email: true }))}
                      onBlur={() => setHoverStates(prev => ({ ...prev, email: false }))}
                    />
                  </motion.div>
                </motion.div>

                <motion.div 
                  variants={itemVariants}
                  className="space-y-2"
                >
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Password
                  </Label>
                  <motion.div
                    whileHover="hover"
                    variants={hoverVariants}
                  >
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className={cn(
                        "bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm",
                        hoverStates.password && "border-blue-400 dark:border-blue-500"
                      )}
                      onFocus={() => setHoverStates(prev => ({ ...prev, password: true }))}
                      onBlur={() => setHoverStates(prev => ({ ...prev, password: false }))}
                    />
                  </motion.div>
                </motion.div>

                <motion.div
                  variants={itemVariants}
                  whileHover="hover"
                  whileTap="tap"
                >
                  <Button 
                    type="submit" 
                    className="w-full relative overflow-hidden"
                    disabled={isLoading}
                    onMouseEnter={() => setHoverStates(prev => ({ ...prev, submit: true }))}
                    onMouseLeave={() => setHoverStates(prev => ({ ...prev, submit: false }))}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <AnimatePresence>
                          {hoverStates.submit && (
                            <motion.span
                              initial={{ x: -100, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              exit={{ x: 100, opacity: 0 }}
                              className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20"
                            />
                          )}
                        </AnimatePresence>
                        <span className="relative z-10">Sign In</span>
                      </>
                    )}
                  </Button>
                </motion.div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
