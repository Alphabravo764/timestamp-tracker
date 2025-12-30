import { describe, it, expect } from "vitest";
import { appRouter } from "../server/routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "../server/_core/context";

type CookieCall = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

function createPublicContext(): { ctx: TrpcContext; setCookies: CookieCall[] } {
  const setCookies: CookieCall[] = [];

  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "http",
      hostname: "localhost",
      headers: {},
      get: (header: string) => {
        if (header === "host") return "localhost:3000";
        return "localhost";
      },
    } as any,
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        setCookies.push({ name, value, options });
      },
      clearCookie: () => {},
    } as any,
  };

  return { ctx, setCookies };
}

describe("Auth - Dev Login", () => {
  it("should create user and set session cookie with devLogin", async () => {
    const { ctx, setCookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // Call devLogin
    const result = await caller.auth.devLogin({
      email: "test@example.com",
      name: "Test User",
    });

    // Verify user was created
    expect(result.user).toBeDefined();
    expect(result.user.email).toBe("test@example.com");
    expect(result.user.name).toBe("Test User");
    expect(result.user.loginMethod).toBe("dev");

    // Verify session cookie was set
    expect(setCookies.length).toBeGreaterThan(0);
    expect(setCookies[0].name).toBe(COOKIE_NAME);
  });
});
