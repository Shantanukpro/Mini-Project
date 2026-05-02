import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertMessage,
  AuthInput,
  AuthShell,
  LockIcon,
  MailIcon,
  SubmitButton,
  UserIcon,
} from "../components/AuthShell";
import axios from "../config/axios";

const initialForm = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
};

function validateRegisterForm(form) {
  const errors = {};
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!form.name.trim()) {
    errors.name = "Name is required.";
  }

  if (!emailPattern.test(form.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (form.password.length < 6) {
    errors.password = "Password must be at least 6 characters.";
  }

  if (form.confirmPassword !== form.password) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}

const Register = () => {
  const [form, setForm] = useState(initialForm);
  const [touched, setTouched] = useState({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const validationErrors = useMemo(() => validateRegisterForm(form), [form]);
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
      .post("/users/register", {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      })
      .then((res) => {
        localStorage.setItem("authToken", res.data.token);
        localStorage.setItem("authUser", JSON.stringify(res.data.user));
        navigate("/");
      })
      .catch((err) => {
        setServerError(err.response?.data?.error || "Unable to create an account. Please try again.");
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }

  return (
    <AuthShell
      footerLinkText="Sign in"
      footerText="Already have an account?"
      footerTo="/login"
      subtitle="Start chatting with developers and AI in real-time"
      title="Create your developer account"
    >
      <form className="space-y-5" noValidate onSubmit={submitHandler}>
        <AlertMessage>{serverError}</AlertMessage>

        <AuthInput
          autoComplete="name"
          error={getFieldError("name")}
          icon={<UserIcon />}
          id="register-name"
          label="Name"
          name="name"
          onBlur={handleBlur}
          onChange={handleChange}
          placeholder="Ada Lovelace"
          value={form.name}
        />

        <AuthInput
          autoComplete="email"
          error={getFieldError("email")}
          icon={<MailIcon />}
          id="register-email"
          label="Email"
          name="email"
          onBlur={handleBlur}
          onChange={handleChange}
          placeholder="you@example.com"
          type="email"
          value={form.email}
        />

        <AuthInput
          autoComplete="new-password"
          error={getFieldError("password")}
          icon={<LockIcon />}
          id="register-password"
          label="Password"
          name="password"
          onBlur={handleBlur}
          onChange={handleChange}
          placeholder="Minimum 6 characters"
          type="password"
          value={form.password}
        />

        <AuthInput
          autoComplete="new-password"
          error={getFieldError("confirmPassword")}
          icon={<LockIcon />}
          id="register-confirm-password"
          label="Confirm Password"
          name="confirmPassword"
          onBlur={handleBlur}
          onChange={handleChange}
          placeholder="Re-enter your password"
          type="password"
          value={form.confirmPassword}
        />

        <SubmitButton disabled={isSubmitting} isLoading={isSubmitting}>
          {isSubmitting ? "Creating account..." : "Create account"}
        </SubmitButton>
      </form>
    </AuthShell>
  );
};

export default Register;
