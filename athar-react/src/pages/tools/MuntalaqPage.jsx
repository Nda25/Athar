import { Layout } from "@/components/layout/Layout";
import MuntalaqTool from "@/features/tools/MuntalaqTool";

export default function MuntalaqPage() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <MuntalaqTool />
      </div>
    </Layout>
  );
}
