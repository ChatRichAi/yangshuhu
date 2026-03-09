import Navbar from "../components/Navbar";
import Pricing from "../components/Pricing";
import FAQ from "../components/FAQ";
import Footer from "../components/Footer";

export const metadata = {
  title: "定价 - 养薯户",
  description: "选择适合你的养薯户套餐，灵活定价，随时升降级。",
};

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16">
        <Pricing />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
