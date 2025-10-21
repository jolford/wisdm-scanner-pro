import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const CookiePolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card className="p-8">
          <h1 className="text-4xl font-bold mb-2">Cookie Policy</h1>
          <p className="text-sm text-muted-foreground mb-8">Last Updated: {new Date().toLocaleDateString()}</p>

          <div className="prose prose-sm max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-3">1. What Are Cookies?</h2>
              <p className="text-muted-foreground">
                Cookies are small text files stored on your device when you visit websites. They help websites remember
                your preferences, improve functionality, and provide analytics about site usage.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">2. How We Use Cookies</h2>
              <p className="text-muted-foreground mb-3">
                Western Integrated Systems uses cookies and similar technologies to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Keep you logged in during your session</li>
                <li>Remember your preferences and settings</li>
                <li>Understand how you use our service</li>
                <li>Improve service performance and user experience</li>
                <li>Provide security features and prevent fraud</li>
                <li>Analyze usage patterns and trends</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">3. Types of Cookies We Use</h2>

              <h3 className="text-xl font-semibold mb-2">Essential Cookies (Required)</h3>
              <p className="text-muted-foreground mb-3">
                These cookies are necessary for the Service to function properly. They cannot be disabled.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-semibold">Cookie Name</th>
                      <th className="text-left p-2 font-semibold">Purpose</th>
                      <th className="text-left p-2 font-semibold">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b">
                      <td className="p-2">sb-access-token</td>
                      <td className="p-2">Authentication and session management</td>
                      <td className="p-2">Session</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2">sb-refresh-token</td>
                      <td className="p-2">Maintains user login state</td>
                      <td className="p-2">7 days</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2">user-preferences</td>
                      <td className="p-2">Stores UI preferences and settings</td>
                      <td className="p-2">1 year</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-xl font-semibold mb-2 mt-6">Analytics Cookies (Optional)</h3>
              <p className="text-muted-foreground mb-3">
                These cookies help us understand how users interact with our Service so we can improve it.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-semibold">Cookie Name</th>
                      <th className="text-left p-2 font-semibold">Purpose</th>
                      <th className="text-left p-2 font-semibold">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b">
                      <td className="p-2">_ga</td>
                      <td className="p-2">Google Analytics - user identification</td>
                      <td className="p-2">2 years</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2">_gid</td>
                      <td className="p-2">Google Analytics - session identification</td>
                      <td className="p-2">24 hours</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2">usage-stats</td>
                      <td className="p-2">Internal usage analytics</td>
                      <td className="p-2">30 days</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-xl font-semibold mb-2 mt-6">Functional Cookies (Optional)</h3>
              <p className="text-muted-foreground mb-3">
                These cookies enable enhanced functionality and personalization.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-semibold">Cookie Name</th>
                      <th className="text-left p-2 font-semibold">Purpose</th>
                      <th className="text-left p-2 font-semibold">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b">
                      <td className="p-2">theme-preference</td>
                      <td className="p-2">Remembers your theme selection</td>
                      <td className="p-2">1 year</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2">selected-project</td>
                      <td className="p-2">Remembers your last selected project</td>
                      <td className="p-2">30 days</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2">notification-preferences</td>
                      <td className="p-2">Stores notification settings</td>
                      <td className="p-2">1 year</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">4. Third-Party Cookies</h2>
              <p className="text-muted-foreground mb-3">
                We use services from trusted third parties that may place cookies on your device:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>
                  <strong>Google Analytics:</strong> Website analytics and user behavior tracking
                </li>
                <li>
                  <strong>Supabase:</strong> Authentication and database services
                </li>
                <li>
                  <strong>Payment Processors:</strong> Secure payment processing (if applicable)
                </li>
              </ul>
              <p className="text-muted-foreground mt-3">
                These third parties have their own privacy policies governing cookie use. We recommend reviewing them.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">5. Local Storage and Session Storage</h2>
              <p className="text-muted-foreground">
                In addition to cookies, we use browser local storage and session storage to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Cache authentication tokens for faster access</li>
                <li>Store temporary form data to prevent data loss</li>
                <li>Remember UI state between page refreshes</li>
                <li>Improve application performance</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">6. Managing Your Cookie Preferences</h2>

              <h3 className="text-xl font-semibold mb-2">Browser Settings</h3>
              <p className="text-muted-foreground mb-3">You can control cookies through your browser settings:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>
                  <strong>Chrome:</strong> Settings → Privacy and security → Cookies
                </li>
                <li>
                  <strong>Firefox:</strong> Settings → Privacy & Security → Cookies
                </li>
                <li>
                  <strong>Safari:</strong> Preferences → Privacy → Cookies
                </li>
                <li>
                  <strong>Edge:</strong> Settings → Cookies and site permissions
                </li>
              </ul>

              <h3 className="text-xl font-semibold mb-2 mt-4">Opt-Out Options</h3>
              <p className="text-muted-foreground mb-3">To opt out of analytics cookies:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>
                  <strong>Google Analytics:</strong>{" "}
                  <a
                    href="https://tools.google.com/dlpage/gaoptout"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Google Analytics Opt-out Browser Add-on
                  </a>
                </li>
                <li>
                  <strong>Do Not Track:</strong> Enable "Do Not Track" in your browser (we honor this signal)
                </li>
              </ul>

              <p className="text-muted-foreground mt-4">
                <strong>Note:</strong> Disabling essential cookies may affect the functionality of our Service,
                including the ability to log in and access features.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">7. Cookie Retention</h2>
              <p className="text-muted-foreground">Cookies have different lifespans:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>
                  <strong>Session Cookies:</strong> Deleted when you close your browser
                </li>
                <li>
                  <strong>Persistent Cookies:</strong> Remain until expiration date or manual deletion
                </li>
                <li>
                  <strong>Typical Duration:</strong> 24 hours to 2 years depending on cookie type
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">8. Updates to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this Cookie Policy periodically to reflect changes in our practices or for legal,
                operational, or regulatory reasons. We will notify you of material changes via email or service
                notification.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">9. GDPR and CCPA Rights</h2>
              <p className="text-muted-foreground mb-3">
                If you are located in the EU or California, you have additional rights:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>
                  <strong>Right to Access:</strong> Request information about cookies used
                </li>
                <li>
                  <strong>Right to Deletion:</strong> Request deletion of cookie data
                </li>
                <li>
                  <strong>Right to Object:</strong> Opt out of non-essential cookies
                </li>
                <li>
                  <strong>Right to Withdraw Consent:</strong> Revoke cookie consent at any time
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">10. Contact Us</h2>
              <p className="text-muted-foreground mb-3">For questions about our use of cookies:</p>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="font-semibold">Western Integrated Systems</p>
                <p className="text-muted-foreground">Email: support@westint.com</p>
                <p className="text-muted-foreground">Address: [Your Business Address]</p>
              </div>
            </section>

            <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                <strong>Legal Notice:</strong> This is a template Cookie Policy. Consult with legal counsel to ensure
                compliance with GDPR, ePrivacy Directive, CCPA, and other applicable regulations. Implement a proper
                cookie consent mechanism before deployment.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CookiePolicy;
