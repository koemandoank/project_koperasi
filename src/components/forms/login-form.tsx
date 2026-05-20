"use client";

import Image from "next/image";
import { useActionState } from "react";
import { authenticate } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function LoginForm({ settings }: { settings?: any }) {
  const [errorMessage, formAction, isPending] = useActionState(
    authenticate,
    undefined,
  );

  return (
    <Card className="w-full max-w-md mx-auto shadow-xl">
      <CardHeader className="pb-6">
        <div className="flex flex-col items-center justify-center text-center gap-0">
          <div className="relative h-52 w-52">
            <Image
              src={settings?.logo_url || "/koperasi.png"}
              alt="Logo Koperasi"
              fill
              className="object-contain"
              priority
            />
          </div>
          <div className="space-y-1 -mt-4">
            <CardTitle className="text-lg font-bold tracking-tight text-slate-800 dark:text-slate-100">{settings?.company_name || "Koperasi Digital"}</CardTitle>
            <CardDescription>
              Masukkan email dan password Anda untuk masuk ke sistem
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <form action={formAction}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email / NIK / Username</Label>
            <Input
              id="email"
              name="email"
              type="text"
              placeholder="Masukkan username, email, atau NIK"
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              disabled={isPending}
            />
          </div>

          {errorMessage && (
            <div className="text-sm font-medium text-destructive">
              {errorMessage}
            </div>
          )}
        </CardContent>

        <CardFooter>
          <Button className="w-full" type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Masuk
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
