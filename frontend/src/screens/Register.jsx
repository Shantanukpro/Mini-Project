import React, { useState } from "react";
import { Link ,useNavigate } from "react-router-dom";
import axios from "../config/axios";

const Register = () => {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();

  function submitHandler(e) {

    e.preventDefault();

    axios
      .post("/users/register", {
        email,
        password,
      })
      .then((res) => {
        console.log(res.data);
        navigate("/");
      })
      .catch((err) => {
        console.log(err.response.data);
      });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <div className="w-full max-w-md p-8 bg-gray-900 border border-gray-800 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-center mb-6 text-white hover:text-gray-300 transition-colors">
          Register
        </h1>
        <form onSubmit={submitHandler}
         className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"
            >
              Email
            </label>
            <input
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              id="email"
              className="w-full mt-1 px-4 py-2 text-sm text-gray-900 bg-gray-800 border border-gray-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
              placeholder="Enter your email"
              required
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"
            >
              Password
            </label>
            <input 
             onChange={(e) => setPassword(e.target.value)}
              type="password"
              id="password"
              className="w-full mt-1 px-4 py-2 text-sm text-gray-900 bg-gray-800 border border-gray-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
              placeholder="Enter your password"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          >
            Register
          </button>
        </form>
        <p className="text-sm text-center text-gray-400 mt-4">
          Already have an account? {" "}
          <Link
            to="/login"
            className="text-blue-500 hover:text-blue-400 hover:underline focus:outline-none transition-colors"
          >
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
