import React from 'react';
import SignIn from './SignIn';

// Phone-only policy: delegate Login to the SignIn (phone OTP) component
const Login: React.FC = () => {
  return <SignIn />;
};

export default Login;