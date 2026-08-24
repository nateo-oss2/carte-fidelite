import "express";

declare global {
  namespace Express {
    interface Request {
      terminal?: {
        id: string;
        companyId: string;
        label: string;
      };
      platformAdmin?: {
        id: string;
        email: string;
      };
      employee?: {
        id: string;
        companyId: string;
        role: string;
        name: string;
      };
    }
  }
}

export {};
