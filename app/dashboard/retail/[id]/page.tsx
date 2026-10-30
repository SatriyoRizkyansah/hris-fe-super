import RetailOrderDetailPage from "../RetailOrderDetailPage";

export default function Page({ params }: { params: { id: string } }) {
  return <RetailOrderDetailPage id={params.id} />;
}
