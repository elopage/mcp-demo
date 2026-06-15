# Flat-mode grant against the LOCAL ablefy backend — the real access-grant spine.
#
# Drives a comped €9 purchase to a *real* Postgres row the demo can SELECT:
#
#   comped order (give_for_free) → membership Sellable → Sellable#process_membership_session!
#                                                        → a real MembershipSession
#
# This mirrors ablefy's own grant path (Order#charge_or_give_access! →
# success_post_processing! → payment(true) → Sellable#process_membership_session!);
# we invoke the terminal access-grant step directly because the fuller path carries
# checkout-only notification side-effects (Notific) that don't apply to a CLI comp.
#
# Inputs (env): GRANT_PRODUCT_ID, GRANT_BUYER_EMAIL
# Output (stdout, machine-parseable):  MEMBERSHIP_SESSION_ID=<id>  (+ REUSED=true if idempotent hit)
#                                or:   GRANT_ERROR=<reason>
#
# Run (NEVER against production):
#   docker exec -e GRANT_PRODUCT_ID=1 -e GRANT_BUYER_EMAIL=buyer@gmail.com \
#     -i elopage-rails-app-1 bin/rails runner - < seed/grant_flat.rb
#
# Lives in mcp-demo on purpose — demo code never lands in the ablefy backend (see AGENTS.md).

ActiveRecord::Base.logger = nil
SemanticLogger.default_level = :fatal rescue nil

def emit(line); STDOUT.puts(line); STDOUT.flush; end

def run
  return emit("GRANT_ERROR=refuses_in_#{Rails.env}") if Rails.env.production?

  pid   = ENV["GRANT_PRODUCT_ID"].to_s.strip
  email = ENV["GRANT_BUYER_EMAIL"].to_s.strip.downcase
  return emit("GRANT_ERROR=missing_product_id") if pid.empty?
  return emit("GRANT_ERROR=missing_buyer_email") if email.empty?

  product = Product.find_by(id: pid)
  return emit("GRANT_ERROR=product_not_found:#{pid}") unless product
  return emit("GRANT_ERROR=product_not_membership:form=#{product.form}") unless product.membership?
  seller   = product.seller
  currency = product.pricing_plans.first&.currency || Currency.by_key(Currency::EUR).first || Currency.first
  plan     = product.pricing_plans.first

  ms_scope = lambda do
    MembershipSession
      .joins(sellable: { order: { payer: :user } })
      .where(users: { email: email })
      .where(sellables: { sellable_type: "Product", sellable_id: product.id })
      .where(publish_state: :publishing)
  end

  # Idempotent: a buyer who already holds access is not re-granted (no double access row).
  if (existing = ms_scope.call.first)
    return emit("MEMBERSHIP_SESSION_ID=#{existing.id} REUSED=true")
  end

  # Buyer identity (plain AR — avoids FactoryBot's legal_form cascade collisions).
  user = User.find_by(email: email)
  unless user
    user = User.new(email: email, password: SecureRandom.hex(16))
    user.confirmed_at = Time.current
    user.skip_confirmation! rescue nil
    unless user.save
      return emit("GRANT_ERROR=invalid_buyer_email:#{user.errors.full_messages.join('|')}")
    end
  end
  payer = Payer.find_by(user_id: user.id) || Payer.create!(user: user)

  # Comped order: payment_form free + give_for_free is ablefy's genuine comp path
  # (Order#check_if_good_for_free returns early for give_for_free → valid free order).
  order = Order.new(
    seller: seller, payer: payer, owner: payer, currency: currency, product: product,
    payment_form: :free, give_for_free: true, period_type: :one_time,
    state: 1, activated_at: Time.zone.today, payment_state: :paid
  )
  order.sellables.build(sellable: product, product: product, currency: currency, pricing_plan: plan)
  order.save || order.save(validate: false)

  sellable = order.sellables.first
  sellable.save(validate: false) unless sellable.persisted?
  sellable.process_membership_session! # the real grant → MembershipSession.create(sellable:)

  ms = ms_scope.call.first || sellable.reload.membership_session
  return emit("GRANT_ERROR=no_membership_session_created") unless ms
  emit("MEMBERSHIP_SESSION_ID=#{ms.id}")
rescue => e
  emit("GRANT_ERROR=#{e.class}:#{e.message.to_s.gsub(/\s+/, ' ')[0, 200]}")
end

run
