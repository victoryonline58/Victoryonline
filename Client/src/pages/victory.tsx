import axios, { AxiosError } from "axios";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import BottomNav from "../components/Header";
import { server } from "../contants/keys";
import { userNotExist } from "../redux/reducer/userReducer";
import { RootState } from "../redux/store";
import "../styles/victory.scss";

interface TableData {
  number: number;
  period: number;
  empty: number;
  amount: string;
  status: string;
}

const socket = io(`${server}`);

const App = () => {
  const [tableData, setTableData] = useState<TableData[]>([]);
  const [start, setStart] = useState(false);
  const [bet, setBet] = useState<{ number: number; amount: string }>();

  const { user } = useSelector((state: RootState) => state.userReducer);

  const dispatch = useDispatch();

  useEffect(() => {
    const fetchTableData = async () => {
      try {
        const { data } = await axios.get(`${server}/api/v1/bet/victory`, {
          withCredentials: true,
        });
        setTableData(data.data);
      } catch (error) {
        console.log(error);
        toast.error("Failed to load table data");
      }
    };

    fetchTableData();

    socket.on("userActivated", (data) => {
      setStart(true);
      updateUserStatus("active");
      toast.success(data.message);
    });

    socket.on("userInactive", (data) => {
      setStart(false);
      updateUserStatus("inactive");
      toast.success(data.message);
    });

    socket.on("error", (error) => {
      toast.error(error.message);
    });

    socket.on("betStarted", () => {
      setStart(true);
    });

    socket.on("newGeneratedNumber", (data) => {
      setStart(true);
      setBet({ number: data.generatedNumber, amount: data.updatedAmount });
      setTableData(data.tableData);
    });

    socket.on("betStopped", (data) => {
      setStart(false);
      setBet({ number: data.lastGeneratedNumber, amount: data.finalAmount });
      setTableData(data.tableData);
    });

    return () => {
      socket.off("userActivated");
      socket.off("userInactive");
      socket.off("error");
      socket.off("betStarted");
      socket.off("newGeneratedNumber");
      socket.off("betStopped");
    };
  }, []);

  const updateUserStatus = (status: string) => {
    setTableData((prevData) =>
      prevData?.map((row) => ({
        ...row,
        status: status,
      }))
    );
  };

  const startBetting = () => {
    if (!start) return toast.error("Bet not started yet");
    if (user) {
      if (Number(bet?.amount) > user.coins)
        return toast.error("Insufficient coins to start a bet");
      if (user.status === "active")
        return toast.error("You are already active");
      if (user.status === "banned")
        return toast.error("You are banned, Can't start a bet");

      socket.emit("activeUser", { userId: user?._id }, () => {
        updateUserStatus("active");
      });
    }
  };

  const stopBetting = () => {
    if (!start) return toast.error("Bet not started yet");
    if (user) {
      if (user.status === "inactive")
        return toast.error("You are already inactive");
      if (user.status === "banned") return toast.error("You are banned");

      socket.emit("inactiveUser", { userId: user?._id }, () => {
        updateUserStatus("inactive");
      });
    }
  };

  const logoutHandler = async () => {
    try {
      const { data } = await axios.get(`${server}/api/v1/user/logout`, {
        withCredentials: true,
      });

      dispatch(userNotExist());
      toast.success(data.message);
    } catch (error) {
      if (error instanceof AxiosError) {
        toast.error(error?.response?.data?.message || "Something Went Wrong");
      } else {
        console.log("An unknown error occurred:", error);
        toast.error("An unknown error occurred");
      }
    }
  };

  return (
    <div className="app">
      {/* Header Section */}
      <div className="header">
        <div className="user-info">
          <p>
            Username: <span className="font-bold">{user?.name}</span>
          </p>
          <p>
            Balance: <span className="font-bold">{user?.coins.toFixed(2)}</span>
          </p>
        </div>
        <p>
          Bets are scheduled to be placed every 5 minutes. Countdown to the next
          placement!
        </p>
        <Link to={"/login"} onClick={logoutHandler} className="exit-btn">
          Exit
        </Link>
      </div>

      {/* Tab Section */}
      <div className="tabs">
        {/* <button className="tab active">Plan</button>
        <button className="tab">Settings</button>
        <button className="tab">History</button>
        <button className="tab">Srpk10</button> */}
      </div>

      {/* Table Section */}
      <div className="table-section">
        <table>
          <thead>
            <tr>
              <th>Number</th>
              <th>Period</th>
              <th>Empty</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {tableData?.map((row, index) => (
              <tr key={index}>
                <td>{row.number}</td>
                <td>{row.period}</td>
                <td>{row.empty}</td>
                <td>{Number(row.amount).toFixed(2)}</td>
                <td>{user?.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Buttons Section */}
      <div className="buttons">
        <button className="one-click-btn open" onClick={startBetting}>
          One-click open
        </button>
        <button className="one-click-btn close" onClick={stopBetting}>
          One-click close
        </button>
      </div>
      <br />
      <br />
      <BottomNav />
    </div>
  );
};

export default App;
