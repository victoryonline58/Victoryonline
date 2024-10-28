// App.tsx
import axios from "axios";
import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import Loader from "./components/Loader";
import { server } from "./contants/keys";
import { userExist, userNotExist } from "./redux/reducer/userReducer";
import { RootState } from "./redux/store";

import ProtectedRoute from "./components/ProtectedRoute";
import { Co2Sharp } from "@mui/icons-material";

const Home = lazy(() => import("./pages/Home"));
const Lottery = lazy(() => import("./pages/lottery"));
const LotteryResult = lazy(() => import("./pages/lottryresult"));
const Profile = lazy(() => import("./pages/profile"));
const Login = lazy(() => import("./pages/login"));
const Register = lazy(() => import("./pages/registration"));
const Victory = lazy(() => import("./pages/victory"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Payment = lazy(() => import("./pages/Payment"));
const Users = lazy(() => import("./pages/admin/users"));
const AdminHome= lazy(() => import("./pages/admin/adminHome"));
const Lottrystart = lazy(() => import("./pages/admin/lottrystart"));

const App = () => {
  const { user, isAdmin, loading } = useSelector(
    (state: RootState) => state.userReducer
  );
  const dispatch = useDispatch();

  useEffect(() => {
    if (user) {
      axios
        .get(`${server}/api/v1/user/${user._id}`, { withCredentials: true })
        .then(({ data }) => dispatch(userExist(data.user)))
        .catch(() => dispatch(userNotExist()));
    } else dispatch(userNotExist());
  }, [dispatch]);

  return loading ? (
    <Loader />
  ) : (
    <Router>
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route
            path="/register"
            element={
              <ProtectedRoute isAuthenticated={user ? false : true}>
                <Register />
              </ProtectedRoute>
            }
          />
          <Route
            path="/login"
            element={
              <ProtectedRoute
                isAuthenticated={user ? false : true}
                redirect="/"
              >
                <Login />
              </ProtectedRoute>
            }
          />

          <Route
            element={<ProtectedRoute isAuthenticated={user ? true : false} />}
          >
            <Route path="/" element={<Home />} />
            <Route path="/lottery" element={<Lottery />} />
            <Route path="/lottryresult" element={<LotteryResult />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/victory" element={<Victory />} />
            <Route path="/payment" element={<Payment />} />
          </Route>
          <Route
            element={
              <ProtectedRoute
                isAuthenticated={true}
                adminOnly={true}
                admin={user?.role === "admin" ? true : false}
              />
            }
          >
            {/* Admin Routes */}
            <Route path="/users" element={<Users />}/>
            <Route path="/admin" element={<AdminHome />}/>
            <Route path="/lottrystart" element={<Lottrystart />}

            />
            </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Toaster position="bottom-center" />
    </Router>
  );
};

export default App;
