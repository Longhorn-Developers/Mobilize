import express from "express";
import { getRoute } from "../controllers/orsController.js";

const router = express.Router();

router.post("/route", getRoute);

export default router;
