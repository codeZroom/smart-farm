"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@/schemas";
import { z } from "zod";
import { Sprout, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function Login() {
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
  });
  return (
    <main className="login">
      <section className="login-story">
        <Sprout size={40} />
        <span className="eyebrow">SMART FARM MONITORING</span>
        <h1>
          농장의 오늘을
          <br />더 가까이.
        </h1>
        <p>
          온도와 습도의 작은 변화까지.
          <br />
          어디서든 농장의 상태를 확인하세요.
        </p>
        <div className="story-lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <small>온실 · CONNECTED GROWING</small>
      </section>
      <section className="login-form">
        <div className="brand">
          <Sprout /> 온실 <small>SMART FARM</small>
        </div>
        <h2>다시 오신 것을 환영합니다</h2>
        <p className="muted">농장을 관리하려면 로그인해 주세요.</p>
        <form
          onSubmit={handleSubmit(async (values) => {
            setError("");
            try {
              const res = await fetch("/api/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error);
              location.href = "/dashboard";
            } catch (e) {
              setError(e instanceof Error ? e.message : "연결 오류");
            }
          })}
        >
          <label>
            이메일
            <input autoComplete="email" type="email" {...register("email")} />
          </label>
          {errors.email && <p role="alert">올바른 이메일을 입력해 주세요.</p>}
          <label>
            비밀번호
            <input
              autoComplete="current-password"
              type="password"
              {...register("password")}
            />
          </label>
          {errors.password && <p role="alert">8자 이상 입력해 주세요.</p>}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <Button disabled={isSubmitting}>
            {isSubmitting ? "로그인 중…" : "로그인"} <ArrowRight size={18} />
          </Button>
        </form>
        <p className="muted small">
          계정은 농장 관리자에게 발급받으세요.
        </p>
      </section>
    </main>
  );
}
