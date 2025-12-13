import { Router, Response, response } from "express";
import { auth } from "../lib/auth";
import { fromNodeHeaders } from "better-auth/node";
import prisma from "../lib/prisma.client";
import { authMiddleware, requireRoles } from "../middlewares/auth.middleware";
import { Roles } from "@prisma/client";
import { resend } from "../services/resend.service";

const router = Router();

router.get("/", authMiddleware, async (req: any, res: Response) => {
   const user = req.user;
   //if user is root or administrator, return all users
   const { page = 1, limit = 25 } = req.query;
   if (user.role === Roles.ROOT || user.role === Roles.ADMINISTRATOR) {
      const [total, rows] = await Promise.all([
         prisma.user.count(),
         prisma.user.findMany({
            select: {
               id: true,
               email: true,
               name: true,
               role: true,
               createdAt: true,
               updatedAt: true,
               agency: {
                  select: {
                     id: true,
                     name: true,
                     agency_type: true,
                  },
               },
            },
            skip: (parseInt(page as string) - 1) * (parseInt(limit as string) || 25),
            take: parseInt(limit as string) || 25,
            orderBy: {
               createdAt: "desc",
            },
         }),
      ]);
      res.status(200).json({ rows, total });
   } else {
      //return all users in the agency and children agencies
      const agency = await prisma.agency.findUnique({
         where: {
            id: user.agency_id,
         },
      });
      const children = await prisma.agency.findMany({
         where: {
            parent_agency_id: user.agency_id,
         },
      });
      const allAgencies = [agency, ...children];

      const total = await prisma.user.count({
         where: {
            agency_id: user.agency_id,
         },
      });
      const rows = await prisma.user.findMany({
         select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
            updatedAt: true,
            agency: {
               select: {
                  id: true,
                  name: true,
                  agency_type: true,
               },
            },
         },
         where: {
            agency_id: {
               in: allAgencies.map((agency) => agency?.id || 0),
            },
         },
         skip: (parseInt(page as string) - 1) * (parseInt(limit as string) || 25),
         take: parseInt(limit as string) || 25,
      });

      res.status(200).json({ rows, total });
   }
});
router.get("/search", async (req, res) => {
   const { query } = req.query;

   const users = await auth.api.listUserAccounts({
      headers: fromNodeHeaders(req.headers),
   });
   res.status(200).json(users);
});

router.post("/sign-up/email", authMiddleware, async (req, res) => {
   try {
      const { email, password, agency_id, role, name } = req.body;
      console.log(req.body, "req.body");

      // Register user with external auth provider
      const response = await auth.api.signUpEmail({
         returnHeaders: true,
         body: {
            email,
            password,
            name,
         },
      });

      if (!response.token) {
         return res.status(400).json({ message: "User registration failed." });
      }

      // Update internal Prisma user record
      const updatedUser = await prisma.user.update({
         where: { email },
         data: {
            agency_id,
            role,
         },
      });

      return res.status(200).json(updatedUser);
   } catch (error) {
      console.error("Error during sign-up:", error);
      return res.status(500).json({ message: "Internal error", error });
   }
});

router.post("/sign-in/email", async (req, res) => {
   const { email, password } = req.body;

   if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
   }

   // signInEmail returns { token, user } when successful
   const response = await auth.api.signInEmail({
      body: { email, password },
      headers: fromNodeHeaders(req.headers),
   });

   if (!response?.token) {
      return res.status(401).json({ message: "Invalid email or password" });
   }

   // Use the token to get the full session
   const sessionHeaders = fromNodeHeaders({
      ...req.headers,
      authorization: `Bearer ${response.token}`,
   });

   const session = await auth.api.getSession({
      headers: sessionHeaders,
   });

   if (!session?.user) {
      return res.status(401).json({ message: "Failed to retrieve user session" });
   }

   const agency = session.user.agency_id
      ? await prisma.agency.findUnique({
           where: {
              id: session.user.agency_id,
           },
        })
      : null;

   res.status(200).json({
      ...session,
      agency,
   });
});

router.get("/get-session", async (req, res) => {
   const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
   });
   res.status(200).json(session);
});

router.post("/forgot-password", async (req, res) => {
   const { email } = req.body;
   const response = await auth.api.forgetPassword({
      headers: fromNodeHeaders(req.headers),
      body: { email },
   });
   res.status(200).json(response);
});

router.post("/reset-password", async (req, res) => {
   const { password } = req.body;
   const resendResponse = await resend.emails.send({
      from: "soporte@api.ctenvios.com",
      to: "yleecruz@gmail.com",
      subject: "Reset your password now!",
      html: `<strong>it Works</strong> `,
   });
   console.log(resendResponse);
   if (resendResponse.error) {
      return res.status(500).json({ message: "Error sending email" });
   }
   const response = await auth.api.resetPassword({
      headers: fromNodeHeaders(req.headers),
      body: { newPassword: password },
   });
   res.status(200).json(response);
});

router.post("/sign-out", async (req, res) => {
   const user = await auth.api.signOut({
      headers: fromNodeHeaders(req.headers),
   });

   res.status(200).json(user);
});

export default router;
