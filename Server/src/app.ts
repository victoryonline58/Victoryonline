import { Server, Socket } from "socket.io";
import { createServer } from "http";
import express from "express";
import { config } from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorMiddleware } from "./middlewares/error.js";
import { connectDB } from "./utils/features.js";
import { corsOption } from "./constants/config.js";
import betRoute from "./routes/bet.js";
import paymentRoute from "./routes/payment.js";
import dashboardRoute from "./routes/stats.js";
import userRoute from "./routes/user.js";
import { Bet } from "./models/bet.js";
import { GeneratedBet } from "./models/generatedBet.js";

config({
  path: "./.env",
});

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "";

connectDB(MONGO_URI);

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true
  },
  path: "/socket.io/",
});

// Express middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors(corsOption));

// Routes
app.use("/api/v1/user", userRoute);
app.use("/api/v1/payment", paymentRoute);
app.use("/api/v1/bet", betRoute);
app.use("/api/v1/dashboard", dashboardRoute);

// New route to get all bets (active and completed) with their generated numbers
app.get("/api/v1/bets", async (req, res) => {
  try {
    const bets = await Bet.find().sort({ createdAt: -1 }).limit(10);
    const betsWithNumbers = await Promise.all(bets.map(async (bet) => {
      const generatedNumbers = await GeneratedBet.find({ betId: bet._id }).sort({ timestamp: 1 });
      return {
        ...bet.toObject(),
        generatedNumbers: generatedNumbers
      };
    }));
    res.json(betsWithNumbers);
  } catch (error) {
    res.status(500).json({ message: "Error fetching bets" });
  }
});

app.use(errorMiddleware);

// Store active intervals
const activeIntervals: { [key: string]: NodeJS.Timeout } = {};

const generateRandomNumber = (exclude: number): number => {
  let num: number;
  do {
    num = Math.floor(Math.random() * (19 - 2 + 1)) + 2;
  } while (num === exclude);
  return num;
};

const getIncreasePercentage = (userNum: number): number => {
  if ([7, 8, 14, 15].includes(userNum)) return 0.09;
  if ([5, 6, 16, 17].includes(userNum)) return 0.06;
  if ([9, 10, 12, 13].includes(userNum)) return 0.12;
  if (userNum === 11) return 0.15;
  return 0.03;
};

const startBetInterval = async (bet: any) => {
  let currentAmount = bet.amount;
  const increasePercentage = getIncreasePercentage(bet.number);

  const intervalId = setInterval(async () => {
    const randomNum = generateRandomNumber(bet.number);
    currentAmount *= 1 + increasePercentage;

    const generatedBet = await GeneratedBet.create({
      betId: bet._id,
      generatedNumber: randomNum,
      updatedAmount: currentAmount,
      timestamp: new Date(),
    });

    io.emit("newGeneratedNumber", {
      betId: bet._id,
      generatedNumber: randomNum,
      updatedAmount: currentAmount.toFixed(2)
    });
  }, 300000);

  activeIntervals[bet._id.toString()] = intervalId;
};

// Check for any active bets on server start and restart their intervals
const initializeActiveBets = async () => {
  const activeBets = await Bet.find({ status: 'active' });
  for (const bet of activeBets) {
    startBetInterval(bet);
  }
};

initializeActiveBets();

io.on("connection", (socket: Socket) => {
  console.log("Client connected:", socket.id);

  socket.on("startBet", async ({ number, amount }) => {
    try {
      const bet = await Bet.create({ number, amount, status: 'active' });
      startBetInterval(bet);

      socket.emit("betStarted", {
        betId: bet._id,
        message: "Bet started successfully",
      });
    } catch (error) {
      socket.emit("error", { message: "Failed to start bet" });
    }
  });

  socket.on("stopBet", async ({ betId }) => {
    try {
      const intervalId = activeIntervals[betId];
      if (intervalId) {
        clearInterval(intervalId);
        delete activeIntervals[betId];

        const bet = await Bet.findById(betId);
        if (bet) {
          const lastGeneratedBet = await GeneratedBet.findOne({ betId }).sort({ timestamp: -1 });
          
          if (lastGeneratedBet) {
            const increasePercentage = getIncreasePercentage(bet.number);
            const finalAmount = lastGeneratedBet.updatedAmount * (1 + increasePercentage);

            const finalGeneratedBet = await GeneratedBet.create({
              betId: bet._id,
              generatedNumber: bet.number,
              updatedAmount: finalAmount,
              timestamp: new Date(),
            });

            await Bet.findByIdAndUpdate(betId, {
              amount: finalAmount,
              status: 'completed'
            });

            io.emit("betStopped", {
              betId,
              lastGeneratedNumber: bet.number,
              finalAmount: finalAmount.toFixed(2),
            });
          } else {
            socket.emit("error", { message: "No generated numbers found" });
          }
        } else {
          socket.emit("error", { message: "Bet not found" });
        }
      } else {
        socket.emit("error", { message: "No active bet found with this ID" });
      }
    } catch (error) {
      console.error("Error stopping bet:", error);
      socket.emit("error", { message: "Failed to stop bet" });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server is working on port ${PORT}`);
});