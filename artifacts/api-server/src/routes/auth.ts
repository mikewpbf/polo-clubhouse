import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { generateToken, requireAuth, getUserWithRoles, optionalAuth } from "../lib/auth";
import { sendEmail, passwordResetEmailHtml } from "../lib/email";
import { SignupBody, LoginBody } from "@workspace/api-zod";

const router: IRouter = Router();

const resetTokens = new Map<string, { userId: string; expiresAt: number }>();

router.post("/auth/signup", async (req, res) => {
  try {
    const body = SignupBody.parse(req.body);
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, body.email));
    if (existing.length > 0) {
      res.status(400).json({ message: "Email already registered" });
      return;
    }
    const passwordHash = await bcrypt.hash(body.password, 10);
    const [user] = await db.insert(usersTable).values({
      email: body.email,
      displayName: body.displayName,
      passwordHash,
      role: "spectator",
    }).returning();
    const token = generateToken({ id: user.id, email: user.email!, displayName: user.displayName!, role: user.role! });
    const userWithRoles = await getUserWithRoles(user.id);
    res.status(201).json({ user: userWithRoles, token });
  } catch (e: any) {
    res.status(400).json({ message: e.message || "Signup failed" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) { res.status(400).json({ message: "Email/username and password required" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (!user || !user.passwordHash) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }
    const token = generateToken({ id: user.id, email: user.email!, displayName: user.displayName!, role: user.role! });
    const userWithRoles = await getUserWithRoles(user.id);
    res.json({ user: userWithRoles, token });
  } catch (e: any) {
    res.status(400).json({ message: e.message || "Login failed" });
  }
});

router.post("/auth/logout", (_req, res) => {
  res.json({ message: "Logged out" });
});

router.get("/auth/me", optionalAuth, async (req, res) => {
  if (!req.user) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const userWithRoles = await getUserWithRoles(req.user.id);
  if (!userWithRoles) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  res.json(userWithRoles);
});

router.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) { res.status(400).json({ message: "Email is required" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (!user) {
      res.json({ message: "If an account with that email exists, a password reset link has been sent." });
      return;
    }
    const token = crypto.randomBytes(32).toString("hex");
    resetTokens.set(token, { userId: user.id, expiresAt: Date.now() + 60 * 60 * 1000 });
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["host"] || "localhost";
    const resetUrl = `${protocol}://${host}/reset-password?token=${token}`;
    console.log(`[Password Reset] User: ${email} | Reset URL: ${resetUrl}`);

    sendEmail({
      to: email,
      subject: "Reset Your Password - Polo Clubhouse",
      html: passwordResetEmailHtml({
        displayName: user.displayName || email,
        resetUrl,
      }),
    }).catch((err) => console.error("[Email] Password reset email failed:", err));

    res.json({ message: "If an account with that email exists, a password reset link has been sent." });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/auth/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) { res.status(400).json({ message: "Token and new password are required" }); return; }
    if (password.length < 6) { res.status(400).json({ message: "Password must be at least 6 characters" }); return; }
    const entry = resetTokens.get(token);
    if (!entry || entry.expiresAt < Date.now()) {
      resetTokens.delete(token);
      res.status(400).json({ message: "Invalid or expired reset link. Please request a new one." });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, entry.userId));
    resetTokens.delete(token);
    res.json({ message: "Password has been reset successfully. You can now sign in." });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

export default router;
