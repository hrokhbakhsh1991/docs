import { redirect } from "next/navigation";

interface CreatePageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default function CreatePage(props: CreatePageProps) {
  const cloneParam = props.searchParams?.clone;

  if (cloneParam) {
    redirect(`/tours/new?clone=${cloneParam}`);
  }

  redirect("/tours/new");
}
