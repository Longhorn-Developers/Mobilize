import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import orsRoutes from "./routes/orsRoutes.js";
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/ors", orsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
