# Flat-access check against the LOCAL ablefy backend — does this buyer already hold a
# real (publishing) MembershipSession for this coach product?
#
# Inputs (env): CHECK_PRODUCT_ID, CHECK_BUYER_EMAIL
# Output (stdout): HAS_FLAT_ACCESS=true MEMBERSHIP_SESSION_ID=<id>
#             or:  HAS_FLAT_ACCESS=false
#             or:  CHECK_ERROR=<reason>
#
# Run (NEVER against production):
#   docker exec -e CHECK_PRODUCT_ID=1 -e CHECK_BUYER_EMAIL=buyer@gmail.com \
#     -i elopage-rails-app-1 bin/rails runner - < seed/check_flat.rb

ActiveRecord::Base.logger = nil
SemanticLogger.default_level = :fatal rescue nil

def emit(line); STDOUT.puts(line); STDOUT.flush; end

def run
  return emit("CHECK_ERROR=refuses_in_#{Rails.env}") if Rails.env.production?
  pid   = ENV["CHECK_PRODUCT_ID"].to_s.strip
  email = ENV["CHECK_BUYER_EMAIL"].to_s.strip.downcase
  return emit("CHECK_ERROR=missing_args") if pid.empty? || email.empty?

  ms = MembershipSession
         .joins(sellable: { order: { payer: :user } })
         .where(users: { email: email })
         .where(sellables: { sellable_type: "Product", sellable_id: pid })
         .where(publish_state: :publishing)
         .first
  ms ? emit("HAS_FLAT_ACCESS=true MEMBERSHIP_SESSION_ID=#{ms.id}") : emit("HAS_FLAT_ACCESS=false")
rescue => e
  emit("CHECK_ERROR=#{e.class}:#{e.message.to_s.gsub(/\s+/, ' ')[0, 200]}")
end

run
