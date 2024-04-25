import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { customerRoute } from "./routes/customerRoute.js";
import { loanRoute } from "./routes/loanRoute.js";

dotenv.config();

const PORT = process.env.PORT || 8080;

const app = express();     

app.use(express.json());
app.use(cors());

app.use('/api/customer',customerRoute);
app.use('/api/loan',loanRoute);  

app.listen(PORT,()=>{ 
    console.log(`server is running at PORT: ${PORT}`);   
})