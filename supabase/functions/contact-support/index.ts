import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ContactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email().max(255),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(2000),
  userAgent: z.string().max(500).optional(),
});

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const validated = ContactSchema.parse(body);
    const { name, email, subject, message, userAgent } = validated;

    // Send email to support team
    const supportEmailResponse = await resend.emails.send({
      from: "WISDM Support <onboarding@resend.dev>",
      to: ["support@wisdm.com"], // Replace with actual support email
      reply_to: email,
      subject: `Support Request: ${subject}`,
      html: `
        <h2>New Support Request</h2>
        <p><strong>From:</strong> ${name} (${email})</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
        ${userAgent ? `<p><strong>User Agent:</strong> ${userAgent}</p>` : ''}
      `,
    });

    console.log("Support email sent:", supportEmailResponse);

    // Send confirmation email to user
    const confirmationEmailResponse = await resend.emails.send({
      from: "WISDM Support <onboarding@resend.dev>",
      to: [email],
      subject: "We received your support request",
      html: `
        <h1>Thank you for contacting WISDM Support, ${name}!</h1>
        <p>We have received your support request and will get back to you as soon as possible.</p>
        <p><strong>Your request:</strong></p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong> ${message.replace(/\n/g, '<br>')}</p>
        <br>
        <p>Best regards,<br>The WISDM Support Team</p>
      `,
    });

    console.log("Confirmation email sent:", confirmationEmailResponse);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Support request sent successfully"
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in contact-support function:", error);
    
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: error.errors }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    
    return new Response(
      JSON.stringify({ error: "Failed to send support request. Please try again later." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
