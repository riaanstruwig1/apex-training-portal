import { requireAdminOrCFI } from "@/lib/auth/dal";
import { getFormsProcedures } from "@/lib/actions/forms-procedures";
import FormsProceduresEditor from "./forms-procedures-editor";
import { FORMS_SEND_NOTE, getSendRecipients } from "@/lib/forms-send";
import { isWhatsAppConfigured } from "@/lib/whatsapp";
import { getFormsSendTabs } from "@/lib/actions/forms-send-tabs";
import SendTabs from "./send-tabs";

export default async function FormsProceduresAdminPage() {
  await requireAdminOrCFI();
  const [slots, recipients, tabs] = await Promise.all([getFormsProcedures(), getSendRecipients(), getFormsSendTabs()]);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Forms &amp; procedures</h1>
      <p className="mb-6 max-w-2xl text-sm text-slate-500">
        Shared downloads shown to every student and pilot under five headings --
        images, PDFs, PowerPoint presentations or ZIP files, up to 50MB each.
        Use <strong>+ Add item</strong> under a heading; <strong>Edit</strong> moves an item to another heading.
      </p>
      <SendTabs tabs={tabs} slots={slots} recipients={recipients} whatsappReady={isWhatsAppConfigured()} />
      <FormsProceduresEditor
        slots={slots}
        recipients={recipients}
        note={FORMS_SEND_NOTE}
        whatsappReady={isWhatsAppConfigured()}
      />
    </div>
  );
}
