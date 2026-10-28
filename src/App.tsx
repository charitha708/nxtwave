import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Landing } from '@/pages/Landing';
import { Assessment } from '@/pages/Assessment';
import { Results } from '@/pages/Results';
import { Workshop } from '@/pages/Workshop';
import { Register } from '@/pages/Register';
import { RegistrationSuccess } from '@/pages/RegistrationSuccess';
import { Admin } from '@/pages/Admin';
import { Privacy } from '@/pages/Privacy';
import { Terms } from '@/pages/Terms';
import { NotFound } from '@/pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/assessment" element={<Assessment />} />
          <Route path="/assessment/results" element={<Results />} />
          <Route path="/workshop" element={<Workshop />} />
          <Route path="/register" element={<Register />} />
          <Route path="/registration/success" element={<RegistrationSuccess />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
