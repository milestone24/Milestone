import { Router } from "express";
import { z } from "zod";
import { userAccounts } from "../db/schema/user-account";
import {
  loginSchema,
  registerSchema,
  revokeFamilySchema,
} from "@shared/schema/user-account";
import { eq } from "drizzle-orm";
import { compare } from "bcrypt";
import { AUTH_COOKIE_NAMES } from "../constants/auth";
import { AuthRequest, AuthService, requireTenant } from "@server/auth";
import { db } from "@server/db";
import { DatabaseUserService } from "@server/services/users/database";

const userService = new DatabaseUserService(db);

export async function registerRoutes(
  router: Router, 
  authService: AuthService
): Promise<Router> {
  const { requireUser } = authService.getAuthMiddlewares();
  // Login route
  router.post("/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      const user = await db.query.userAccounts.findFirst({
        where: eq(userAccounts.email, email),
      });

      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isValidPassword = await compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const completeUser = await userService.getCompleteUserForAccount(user.id);

      if (!completeUser) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const accessToken = await authService.generateAccessToken({
        tenantAccountId: user.id,
        tenantId: completeUser.id,
      });

      const refreshToken = await await authService.generateRefreshToken({
        tenantAccountId: user.id,
        tenantId: completeUser.id,
        deviceInfo: req.headers["user-agent"] || "unknown",
      });

      authService.setAuthCookies(res, accessToken, refreshToken)

      res.json({
        user: completeUser,
        message: "Login successful",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request" });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Register route
  router.post("/register", async (req, res) => {
    try {
      const { email, password, fullName, phoneNumber } = registerSchema.parse(
        req.body
      );

      const existingUser = await db.query.userAccounts.findFirst({
        where: eq(userAccounts.email, email),
      });

      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const completeUser = await userService.createUserComplete({
        email,
        password,
        fullName,
        phoneNumber,
      });

      // Generate verification tokens
      //const emailToken = await generateEmailVerification(user.id);
      //const phoneToken = phoneNumber ? await generatePhoneVerification(user.id) : null;

      // TODO: Send verification email with emailToken
      // TODO: Send verification SMS with phoneToken if phoneNumber is provided

      const accessToken = await authService.generateAccessToken({
        tenantAccountId: completeUser.account.id,
        tenantId: completeUser.id,
      });

      const refreshToken = await await authService.generateRefreshToken({
        tenantAccountId: completeUser.account.id,
        tenantId: completeUser.id,
        deviceInfo: req.headers["user-agent"] || "unknown",
      });

      authService.setAuthCookies(res, accessToken, refreshToken)

      res.status(201).json({
        user: completeUser,
        message:
          "Registration successful. Please verify your email and phone number.",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request" });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Logout route
  router.post("/logout", requireUser, async (req: AuthRequest, res) => {
    try {
      const refreshToken = req.cookies[AUTH_COOKIE_NAMES.REFRESH_TOKEN];
      if (refreshToken) {
        const { familyId } = await authService.verifyRefreshToken(refreshToken);
        await authService.revokeRefreshTokenFamily({
          tenantId:  req.tenant!.id,
          familyId
        });
      }

      authService.clearAuthCookies(res);
      return res.json({ message: "Logged out successfully" });

    } catch (error) {
      authService.clearAuthCookies(res);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get current user route
  router.get("/me", requireUser, async (req: AuthRequest, res) => {
    try {
      const completeUser = await requireTenant(req.tenant, async (tenant) => {
        return userService.getCompleteUserForAccount(
          tenant?.userAccountId ?? ""
        );
      });

      if (!completeUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ user: completeUser });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Revoke token family route
  router.post("/revoke-family", requireUser, async (req: AuthRequest, res) => {
    try {
      const { familyId } = revokeFamilySchema.parse(req.body);
      await authService.revokeRefreshTokenFamily({
        familyId,
        tenantId: req.tenant!.id
      });
      res.json({ message: "Token family revoked successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request" });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router
}
