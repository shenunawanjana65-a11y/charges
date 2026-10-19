"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { SubmitErrorHandler, useForm, useWatch } from "react-hook-form";
import { Save, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import RequiredField from "@/components/layout/required-field";

import useAxiosAuth from "@/hooks/use-axios-auth";
import useLoadingtStore from "@/stores/useLoadingStore";

export const otherChargeTypes = [
  { id: "COMMISSION", label: "Commission" },
  { id: "INSURANCE", label: "Insurance" },
  { id: "COMMON", label: "Common" },
  { id: "VEHICLE_RELATED", label: "Vehicle Related" },
];

export const otherChargeCategories = [
  { id: "OPEN_PAPERS", label: "Open Papers" },
  { id: "BOOK_OWNER", label: "Book Owner" },
  { id: "GENERAL", label: "General" },
];

export const otherChargeOwnerTypes = [
  { id: "Open Papers", label: "Open Papers" },
  { id: "Book Owner", label: "Book Owner" },
];

export interface OtherChargeRowSchema {
  id: number;
  name: string;
  code: string;
  charge_type: string;
  owner_type: string;
  category: string;
  is_rmv: boolean;
  is_pre_disburse: boolean;
  is_post_disburse: boolean;
  amount_type: "FIXED" | "PERCENTAGE";
  amount: number;
  record_status: number | string;
}

const formSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required.")
      .max(100, "Name cannot exceed 100 characters."),
    code: z
      .string()
      .trim()
      .min(1, "Code is required.")
      .max(50, "Code cannot exceed 50 characters.")
      .regex(
        /^[A-Za-z0-9_-]+$/,
        "Code can contain only letters, numbers, - and _",
      ),
    charge_type: z.string().min(1, "Other Charge Type is required."),
    owner_type: z
      .string()
      .trim()
      .min(1, "Owner Type is required.")
      .max(50, "Owner Type cannot exceed 50 characters."),
    amount_type: z.enum(["FIXED", "PERCENTAGE"]),
    amount: z
      .number()
      .finite("Enter a valid amount.")
      .min(0, "Amount cannot be negative.")
      .max(9999999999.99, "Amount is too large."),
    is_rmv: z.boolean(),
    category: z.string().min(1, "Category is required."),
    is_pre_disburse: z.boolean(),
    is_post_disburse: z.boolean(),
  })
  .refine((data) => data.is_pre_disburse !== data.is_post_disburse, {
    message: "Select exactly one stage.",
    path: ["is_pre_disburse"],
  })
  .refine((data) => data.amount_type !== "PERCENTAGE" || data.amount <= 100, {
    message: "Percentage cannot exceed 100%.",
    path: ["amount"],
  });

type FormValues = z.infer<typeof formSchema>;

const emptyValues: FormValues = {
  name: "",
  code: "",
  charge_type: "",
  owner_type: "",
  amount_type: "FIXED",
  amount: 0,
  is_rmv: false,
  category: "",
  is_pre_disburse: false,
  is_post_disburse: false,
};

interface OtherChargeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  charge?: OtherChargeRowSchema | null; // if provided -> EDIT mode
  onSaved: () => void; // table calls fetchData() here
}

export default function OtherChargeForm({
  open,
  onOpenChange,
  charge,
  onSaved,
}: Readonly<OtherChargeFormProps>) {
  const [saveDialog, setSaveDialog] = useState<{
    title: string;
    message: string;
    success: boolean;
  } | null>(null);
  const axiosAuth = useAxiosAuth();
  const startLoading = useLoadingtStore((state) => state.startLoading);
  const stopLoading = useLoadingtStore((state) => state.stopLoading);

  const isEdit = !!charge?.id;

  const form = useForm<FormValues>({
    mode: "onChange",
    resolver: zodResolver(formSchema),
    defaultValues: emptyValues,
  });
  const isPreDisburse = useWatch({
    control: form.control,
    name: "is_pre_disburse",
  });
  const isPostDisburse = useWatch({
    control: form.control,
    name: "is_post_disburse",
  });
  const amountType = useWatch({
    control: form.control,
    name: "amount_type",
  });

  // load data into the form every time the dialog opens
  useEffect(() => {
    if (!open) return;

    if (charge) {
      form.reset({
        name: charge.name,
        code: charge.code,
        charge_type: charge.charge_type,
        owner_type: charge.owner_type ?? "",
        amount_type: charge.amount_type ?? "FIXED",
        amount: charge.amount,
        is_rmv: charge.is_rmv,
        category: charge.category ?? "",
        is_pre_disburse: charge.is_pre_disburse,
        is_post_disburse: !charge.is_pre_disburse && charge.is_post_disburse,
      });
    } else {
      form.reset(emptyValues);
    }
  }, [open, charge, form]);

  const onSubmit = async (values: FormValues) => {
    startLoading();
    try {
      const response = isEdit
        ? await axiosAuth.put(`/api/admin/other-charges/${charge!.id}`, values)
        : await axiosAuth.post("/api/admin/other-charges", values);

      if (response.data?.success === false) {
        setSaveDialog({
          title: "Save Failed",
          message:
            response?.data?.error?.message ||
            response?.data?.message ||
            "An error occurred while saving the Other Charge.",
          success: false,
        });
        return;
      }

      setSaveDialog({
        title: "Save Successful",
        message:
          response?.data?.message ||
          (isEdit
            ? "Other Charge updated successfully"
            : "Other Charge created successfully"),
        success: true,
      });
    } catch (err: unknown) {
      setSaveDialog({
        title: "Save Failed",
        message:
          (axios.isAxiosError<{ message?: string }>(err)
            ? err.response?.data?.message
            : undefined) || "An error occurred while saving the Other Charge.",
        success: false,
      });
    } finally {
      stopLoading();
    }
  };

  const onError: SubmitErrorHandler<FormValues> = (errors) => {
    const validationMessage = Object.values(errors)
      .map((error) => error?.message)
      .filter((message): message is string => typeof message === "string")
      .join(" ");
    setSaveDialog({
      title: "Check the Form",
      message: validationMessage || "Please recheck the form.",
      success: false,
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit Other Charge" : "Create Other Charge"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit, onError)}
              className="space-y-4"
              id="other_charge_form"
              name="other_charge_form"
            >
              <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Code <RequiredField />
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Ex: 1234"
                          maxLength={50}
                          readOnly={isEdit}
                        />
                      </FormControl>
                      <FormDescription>
                        The code cannot be edited after saving.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Name <RequiredField />
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Ex: Charge Name"
                          maxLength={100}
                          readOnly={isEdit}
                        />
                      </FormControl>
                      <FormDescription>
                        The name cannot be edited after saving.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="charge_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Other Charge Type
                        <RequiredField />
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isEdit}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {otherChargeTypes.map((arr) => (
                            <SelectItem value={arr.id} key={arr.id}>
                              {arr.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        The other charge type cannot be edited after saving.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="owner_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Owner Type
                        <RequiredField />
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Owner Type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {otherChargeOwnerTypes.map((ownerType) => (
                            <SelectItem value={ownerType.id} key={ownerType.id}>
                              {ownerType.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_rmv"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-3 space-y-0">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="m-0">Is RMV Charge</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Category
                        <RequiredField />
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {otherChargeCategories.map((arr) => (
                            <SelectItem value={arr.id} key={arr.id}>
                              {arr.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3 rounded-xl border bg-muted/20 p-5">
                  <FormLabel>
                    Other Charge Stages
                    <RequiredField />
                  </FormLabel>
                  <div
                    className="flex gap-8"
                    role="radiogroup"
                    aria-label="Other Charge Stages"
                  >
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="other-charge-stage"
                        value="pre"
                        checked={isPreDisburse}
                        onChange={() => {
                          form.setValue("is_pre_disburse", true, {
                            shouldValidate: true,
                          });
                          form.setValue("is_post_disburse", false, {
                            shouldValidate: true,
                          });
                        }}
                      />
                      <span className="text-sm font-medium">Pre Disburse</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="other-charge-stage"
                        value="post"
                        checked={isPostDisburse}
                        onChange={() => {
                          form.setValue("is_pre_disburse", false, {
                            shouldValidate: true,
                          });
                          form.setValue("is_post_disburse", true, {
                            shouldValidate: true,
                          });
                        }}
                      />
                      <span className="text-sm font-medium">Post Disburse</span>
                    </label>
                  </div>
                  <p className="text-sm font-medium text-destructive">
                    {form.formState.errors.is_pre_disburse?.message}
                  </p>
                </div>

                <div className="space-y-4 rounded-xl border bg-muted/20 p-5">
                  <FormField
                    control={form.control}
                    name="amount_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Amount Type
                          <RequiredField />
                        </FormLabel>
                        <div
                          className="flex flex-wrap gap-6"
                          role="radiogroup"
                          aria-label="Amount Type"
                        >
                          <label className="flex cursor-pointer items-center gap-2">
                            <input
                              type="radio"
                              name="other-charge-amount-type"
                              value="FIXED"
                              checked={field.value === "FIXED"}
                              onChange={() => field.onChange("FIXED")}
                            />
                            <span className="text-sm font-medium">
                              Fixed Amount (Rs.)
                            </span>
                          </label>
                          <label className="flex cursor-pointer items-center gap-2">
                            <input
                              type="radio"
                              name="other-charge-amount-type"
                              value="PERCENTAGE"
                              checked={field.value === "PERCENTAGE"}
                              onChange={() => field.onChange("PERCENTAGE")}
                            />
                            <span className="text-sm font-medium">
                              Percentage (%)
                            </span>
                          </label>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {amountType === "PERCENTAGE"
                            ? "Percentage (%)"
                            : "Amount (Rs.)"}
                          <RequiredField />
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max={
                              amountType === "PERCENTAGE"
                                ? "100"
                                : "9999999999.99"
                            }
                            step="0.01"
                            value={field.value}
                            onChange={(event) =>
                              field.onChange(
                                event.target.value === ""
                                  ? 0
                                  : Number(event.target.value),
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button type="submit">
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="mr-2 h-4 w-4" />
                  Close
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!saveDialog}
        onOpenChange={(isOpen) => {
          if (!isOpen && saveDialog) {
            setSaveDialog(null);
            if (saveDialog.success) {
              onOpenChange(false);
              onSaved();
            }
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{saveDialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {saveDialog?.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction asChild>
              <Button type="button">OK</Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
