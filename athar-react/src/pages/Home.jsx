import { Layout } from "@/components/layout/Layout";
import { Hero } from "@/components/landing/Hero";
import { Services } from "@/components/landing/Services";
import { Programs } from "@/components/landing/Programs";
import { Quotes } from "@/components/landing/Quotes";
import { SEO } from "@/components/SEO";

export default function Home() {
  return (
    <Layout>
      <SEO page="home" />
      <Hero />
      <Services />
      <Quotes />
      <Programs />
    </Layout>
  );
}
