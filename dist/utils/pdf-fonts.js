"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPdfFonts = exports.FONTS = exports.FONT_PATHS = void 0;
const path = __importStar(require("path"));
exports.FONT_PATHS = {
    REGULAR: path.join(process.cwd(), "assets", "fonts", "Inter-Regular.ttf"),
    MEDIUM: path.join(process.cwd(), "assets", "fonts", "Inter-Medium.ttf"),
    SEMIBOLD: path.join(process.cwd(), "assets", "fonts", "Inter-SemiBold.ttf"),
    BOLD: path.join(process.cwd(), "assets", "fonts", "Inter-Bold.ttf"),
};
exports.FONTS = {
    REGULAR: "Inter-Regular",
    MEDIUM: "Inter-Medium",
    SEMIBOLD: "Inter-SemiBold",
    BOLD: "Inter-Bold",
    NORMAL: "Inter-Regular",
};
const registerPdfFonts = (doc) => {
    try {
        doc.registerFont(exports.FONTS.REGULAR, exports.FONT_PATHS.REGULAR);
        doc.registerFont(exports.FONTS.MEDIUM, exports.FONT_PATHS.MEDIUM);
        doc.registerFont(exports.FONTS.SEMIBOLD, exports.FONT_PATHS.SEMIBOLD);
        doc.registerFont(exports.FONTS.BOLD, exports.FONT_PATHS.BOLD);
    }
    catch (error) {
        console.warn("Failed to register custom fonts, falling back to Helvetica:", error);
    }
};
exports.registerPdfFonts = registerPdfFonts;
