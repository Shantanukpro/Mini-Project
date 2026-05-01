import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "../config/axios";

const Register = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();

  function submitHandler(e) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    axios
      .post("/users/register", {
        email,
        password,
      })
      .then((res) => {
        localStorage.setItem("authToken", res.data.token);
        localStorage.setItem("authUser", JSON.stringify(res.data.user));
        navigate("/");
      })
      .catch((err) => {
        setError(err.response?.data?.error || "Unable to create an account. Please try again.");
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center">
        <form onSubmit={submitHandler} className="w-full rounded-lg border border-slate-800 bg-slate-900 p-8 shadow-xl">
          <h1 className="mb-2 text-center text-3xl font-bold text-white">
          Register
          </h1>
          <p className="mb-6 text-center text-sm text-slate-400">Create an account for the chatbot demo.</p>

          {error && (
            <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}

          <div className="space-y-6">
            <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-300"
            >
              Email
            </label>
            <input
              onChange={(e) => setEmail(e.target.value)}
              value={email}
              type="email"
              id="email"
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your email"
              required
            />
            </div>
            <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-300"
            >
              Password
            </label>
            <input 
             onChange={(e) => setPassword(e.target.value)}
              value={password}
              type="password"
              id="password"
              minLength={6}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your password"
              required
            />
            </div>
          <button
            type="submit"
              disabled={isSubmitting}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
              {isSubmitting ? "Creating account..." : "Register"}
          </button>
          </div>
        <p className="mt-4 text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link
            to="/login"
              className="text-blue-400 transition hover:text-blue-300 hover:underline"
          >
            Login
          </Link>
        </p>
        </form>
      </div>
    </div>
  );
};

export default Register;
