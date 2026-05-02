import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertMessage,
  AuthInput,
  AuthShell,
  LockIcon,
  MailIcon,
  SubmitButton,
} from "../components/AuthShell";
import axios from "../config/axios";

const initialForm = {
  email: "",
  password: "",
};

function validateLoginForm(form) {
  const errors = {};
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(form.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (form.password.length < 6) {
    errors.password = "Password must be at least 6 characters.";
  }

  return errors;
}

const Login = () => {
  const [form, setForm] = useState(initialForm);
  const [touched, setTouched] = useState({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const validationErrors = useMemo(() => validateLoginForm(form), [form]);
  const isFormValid = Object.keys(validationErrors).length === 0;

  function getFieldError(fieldName) {
    return (touched[fieldName] || hasSubmitted) ? validationErrors[fieldName] : "";
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function handleBlur(event) {
    const { name } = event.target;
    setTouched((currentTouched) => ({
      ...currentTouched,
      [name]: true,
    }));
  }

  function submitHandler(event) {
    event.preventDefault();
    setHasSubmitted(true);
    setServerError("");

    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);

    axios
      .post("/users/login", {
        email: form.email.trim(),
        password: form.password,
      })
      .then((res) => {
        localStorage.setItem("authToken", res.data.token);
        localStorage.setItem("authUser", JSON.stringify(res.data.user));
        navigate("/");
      })
      .catch((err) => {
        setServerError(err.response?.data?.error || "Unable to log in. Please try again.");
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }

  return (
    <AuthShell
      footerLinkText="Create one"
      footerText="New to DevChat AI?"
      footerTo="/register"
      subtitle="Continue your developer chats and use @ai when you need a second pair of eyes."
      title="Welcome back"
    >
      <form className="space-y-5" noValidate onSubmit={submitHandler}>
        <AlertMessage>{serverError}</AlertMessage>

        <AuthInput
          autoComplete="email"
          error={getFieldError("email")}
          icon={<MailIcon />}
          id="login-email"
          label="Email"
          name="email"
          onBlur={handleBlur}
          onChange={handleChange}
          placeholder="you@example.com"
          type="email"
          value={form.email}
        />

        <AuthInput
          autoComplete="current-password"
          error={getFieldError("password")}
          icon={<LockIcon />}
          id="login-password"
          label="Password"
          name="password"
          onBlur={handleBlur}
          onChange={handleChange}
          placeholder="Enter your password"
          type="password"
          value={form.password}
        />

        <SubmitButton disabled={isSubmitting} isLoading={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </SubmitButton>
      </form>
    </AuthShell>
  );
};

export default Login;
